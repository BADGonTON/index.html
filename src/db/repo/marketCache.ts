import { pool } from "../pool";

/**
 * Marketapp katalogining oxirgi nusxasi. Bu jadval tufayli bot qayta ishga
 * tushganda ham Mini App BIRINCHI so'rovdanoq to'liq katalogni ko'rsatadi —
 * Marketapp javob berishini kutish shart emas.
 */
export async function saveSnapshot(key: string, payload: unknown, fetchedAt: number): Promise<void> {
  await pool.query(
    `INSERT INTO market_snapshot (key, payload, fetched_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = EXCLUDED.fetched_at`,
    [key, JSON.stringify(payload), fetchedAt]
  );
}

export async function loadSnapshot<T>(key: string): Promise<{ payload: T; fetchedAt: number } | null> {
  const { rows } = await pool.query<{ payload: T; fetched_at: number }>(
    "SELECT payload, fetched_at FROM market_snapshot WHERE key = $1",
    [key]
  );
  if (rows.length === 0) return null;
  return { payload: rows[0].payload, fetchedAt: rows[0].fetched_at };
}
