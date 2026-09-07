import { pool } from "../pool";
import type { CatalogGift } from "../../services/catalog";

/**
 * Katalog keshi — har bir kolleksiya alohida qatorda.
 *
 * Shu tuzilma tufayli bitta kolleksiya Marketapp'da yiqilsa (429, timeout),
 * u faqat o'zining eski holatida qoladi va qolgan katalogga ta'sir qilmaydi.
 */

export interface CollectionRow {
  address: string;
  name: string;
  gifts: CatalogGift[];
  gift_count: number;
  fetched_at: number;
  last_error: string | null;
  last_try_at: number;
}

export async function loadAllCollections(): Promise<CollectionRow[]> {
  const { rows } = await pool.query<CollectionRow>(
    `SELECT address, name, gifts, gift_count, fetched_at, last_error, last_try_at
       FROM market_collections
      ORDER BY name ASC`
  );
  return rows;
}

/** Kolleksiya ro'yxati yangilanganda: nomlarni yozadi, giftlarga TEGMAYDI. */
export async function upsertCollectionNames(
  items: Array<{ address: string; name: string }>
): Promise<void> {
  if (items.length === 0) return;
  const now = Math.floor(Date.now() / 1000);

  await pool.query(
    `INSERT INTO market_collections (address, name, created_at)
     SELECT * FROM UNNEST($1::text[], $2::text[], $3::bigint[])
     ON CONFLICT (address) DO UPDATE SET name = EXCLUDED.name`,
    [items.map((i) => i.address), items.map((i) => i.name), items.map(() => now)]
  );
}

/** Muvaffaqiyatli yangilanish — giftlar almashadi, xato tozalanadi. */
export async function saveCollectionGifts(
  address: string,
  name: string,
  gifts: CatalogGift[],
  fetchedAt: number
): Promise<void> {
  await pool.query(
    `INSERT INTO market_collections
       (address, name, gifts, gift_count, fetched_at, last_error, last_try_at, created_at)
     VALUES ($1, $2, $3::jsonb, $4, $5, NULL, $5, $5)
     ON CONFLICT (address) DO UPDATE SET
       name       = EXCLUDED.name,
       gifts      = EXCLUDED.gifts,
       gift_count = EXCLUDED.gift_count,
       fetched_at = EXCLUDED.fetched_at,
       last_error = NULL,
       last_try_at = EXCLUDED.last_try_at`,
    [address, name, JSON.stringify(gifts), gifts.length, fetchedAt]
  );
}

/**
 * Muvaffaqiyatsiz urinish — FAQAT xato va urinish vaqti yoziladi.
 * `gifts` ustuniga umuman tegilmaydi, shuning uchun eski ishlaydigan
 * ma'lumot saqlanib qoladi.
 */
export async function markCollectionFailed(address: string, error: string): Promise<void> {
  await pool.query(
    `UPDATE market_collections
        SET last_error = $2, last_try_at = $3
      WHERE address = $1`,
    [address, error.slice(0, 500), Math.floor(Date.now() / 1000)]
  );
}

/** Marketapp ro'yxatidan chiqib ketgan kolleksiyalarni olib tashlaydi. */
export async function deleteMissingCollections(keepAddresses: string[]): Promise<number> {
  if (keepAddresses.length === 0) return 0;
  const { rowCount } = await pool.query(
    "DELETE FROM market_collections WHERE address <> ALL($1::text[])",
    [keepAddresses]
  );
  return rowCount ?? 0;
}
