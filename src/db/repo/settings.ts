import { pool } from "../pool";

export async function getSetting(key: string, fallback: string | null = null): Promise<string | null> {
  const { rows } = await pool.query<{ value: string }>(
    "SELECT value FROM settings WHERE key = $1",
    [key]
  );
  return rows.length > 0 ? rows[0].value : fallback;
}

export async function setSetting(key: string, value: string | number): Promise<void> {
  await pool.query(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, String(value)]
  );
}
