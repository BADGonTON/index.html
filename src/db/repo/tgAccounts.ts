import { pool } from "../pool";

export interface TgAccountRow {
  id: number;
  phone: string;
  session_string: string;
  two_fa: string | null;
  price: number;
  status: "available" | "pending" | "sold";
  buyer_id: number | null;
  created_at: number;
  sold_at: number | null;
}

export async function addTgAccount(input: {
  phone: string;
  session_string: string;
  two_fa: string | null;
  price: number;
}): Promise<TgAccountRow> {
  const { rows } = await pool.query<TgAccountRow>(
    `INSERT INTO tg_accounts (phone, session_string, two_fa, price, status, created_at)
     VALUES ($1, $2, $3, $4, 'available', $5)
     RETURNING *`,
    [input.phone, input.session_string, input.two_fa, input.price, Math.floor(Date.now() / 1000)]
  );
  return rows[0];
}

/** Faqat ko'rish uchun — navbatdagi eng eski mavjud akkaunt (band qilmasdan). */
export async function peekNextAvailable(): Promise<TgAccountRow | null> {
  const { rows } = await pool.query<TgAccountRow>(
    "SELECT * FROM tg_accounts WHERE status = 'available' ORDER BY id ASC LIMIT 1"
  );
  return rows[0] ?? null;
}

/**
 * Navbatdagi mavjud akkauntni ATOMIK ravishda xaridorga biriktiradi
 * (FOR UPDATE SKIP LOCKED — bir vaqtda ikki kishi bitta akkauntni ololmaydi).
 */
export async function claimNextAvailable(buyerId: number): Promise<TgAccountRow | null> {
  const { rows } = await pool.query<TgAccountRow>(
    `UPDATE tg_accounts
     SET status = 'pending', buyer_id = $1
     WHERE id = (
       SELECT id FROM tg_accounts
       WHERE status = 'available'
       ORDER BY id ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    [buyerId]
  );
  return rows[0] ?? null;
}

/** Xaridga qaytariladi (masalan balans yetmasa) — akkaunt yana 'available' bo'ladi. */
export async function releaseAccount(id: number): Promise<void> {
  await pool.query(
    "UPDATE tg_accounts SET status = 'available', buyer_id = NULL WHERE id = $1",
    [id]
  );
}

export async function markSold(id: number): Promise<void> {
  await pool.query(
    "UPDATE tg_accounts SET status = 'sold', sold_at = $1 WHERE id = $2",
    [Math.floor(Date.now() / 1000), id]
  );
}

export async function getTgAccount(id: number): Promise<TgAccountRow | null> {
  const { rows } = await pool.query<TgAccountRow>("SELECT * FROM tg_accounts WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function countTgAccountsByStatus(): Promise<Record<string, number>> {
  const { rows } = await pool.query<{ status: string; count: string }>(
    "SELECT status, COUNT(*)::int AS count FROM tg_accounts GROUP BY status"
  );
  const result: Record<string, number> = { available: 0, pending: 0, sold: 0 };
  for (const r of rows) result[r.status] = Number(r.count);
  return result;
}
