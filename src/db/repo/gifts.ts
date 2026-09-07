import { pool } from "../pool";

export interface GiftRow {
  id: string; // Fragment gift_id (masalan "6046178578163303744")
  star_count: number;
  emoji: string;
  premium_id: string | null; // custom-emoji preview id (ixtiyoriy)
  title: string | null;
  active: boolean;
  created_at: string;
}

export async function listGifts(activeOnly = true): Promise<GiftRow[]> {
  const { rows } = await pool.query<GiftRow>(
    activeOnly
      ? "SELECT * FROM gifts WHERE active = TRUE ORDER BY star_count ASC, created_at ASC"
      : "SELECT * FROM gifts ORDER BY star_count ASC, created_at ASC"
  );
  return rows;
}

export async function getGift(id: string): Promise<GiftRow | null> {
  const { rows } = await pool.query<GiftRow>("SELECT * FROM gifts WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function addGift(input: {
  id: string;
  star_count: number;
  emoji?: string;
  premium_id?: string | null;
  title?: string | null;
}): Promise<GiftRow> {
  const { rows } = await pool.query<GiftRow>(
    `INSERT INTO gifts (id, star_count, emoji, premium_id, title, active)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     ON CONFLICT (id) DO UPDATE SET
        star_count = EXCLUDED.star_count,
        emoji = EXCLUDED.emoji,
        premium_id = EXCLUDED.premium_id,
        title = EXCLUDED.title,
        active = TRUE
     RETURNING *`,
    [input.id, input.star_count, input.emoji ?? "🎁", input.premium_id ?? null, input.title ?? null]
  );
  return rows[0];
}

export async function updateGiftPrice(id: string, starCount: number): Promise<boolean> {
  const { rowCount } = await pool.query("UPDATE gifts SET star_count = $1 WHERE id = $2", [
    starCount,
    id,
  ]);
  return (rowCount ?? 0) > 0;
}

export async function setGiftActive(id: string, active: boolean): Promise<boolean> {
  const { rowCount } = await pool.query("UPDATE gifts SET active = $1 WHERE id = $2", [active, id]);
  return (rowCount ?? 0) > 0;
}

export async function deleteGift(id: string): Promise<boolean> {
  const { rowCount } = await pool.query("DELETE FROM gifts WHERE id = $1", [id]);
  return (rowCount ?? 0) > 0;
}
