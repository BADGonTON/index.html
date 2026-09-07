import { Pool, types } from "pg";
import { config } from "../config";

// PostgreSQL BIGINT (OID 20) ni JS "string" o'rniga "number" qilib qaytaramiz.
// Telegram user_id va unix vaqt belgilari Number.MAX_SAFE_INTEGER (2^53) dan
// oshmaydi, shuning uchun bu xavfsiz va kod bo'ylab BigInt bilan ovora
// bo'lishning oldini oladi.
types.setTypeParser(20, (val: string) => parseInt(val, 10));
// NUMERIC (OID 1700) — TON summalari uchun. DIQQAT: nanoTON qiymatlari
// (price_per_day_nano) bazadan STRING sifatida o'qiladi, chunki ular 2^53 dan
// katta bo'lishi mumkin. Shu sabab bu yerda parser O'RNATILMAYDI.

/**
 * Yagona (singleton) PostgreSQL pool. Butun loyiha shu poolni ishlatadi.
 *
 * Sig'im haqida: 200 000 foydalanuvchi bazada bo'lishi poolga umuman ta'sir
 * qilmaydi — muhimi bir VAQTDA nechta so'rov ketayotgani. PG_POOL_MAX
 * (default 20) bitta process uchun yetarli; bir nechta instance ishlatsangiz,
 * ularning yig'indisi PostgreSQL'ning max_connections dan kichik bo'lsin
 * (yoki old tomonga PgBouncer qo'ying).
 */
export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.pgSsl ? { rejectUnauthorized: false } : undefined,
  max: config.pgPoolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // Bitta osilib qolgan so'rov butun poolni bloklab qo'ymasligi uchun.
  statement_timeout: config.pgStatementTimeoutMs,
});

pool.on("error", (err) => {
  console.error("❌ PostgreSQL pool xatosi:", err.message);
});

/**
 * Bir nechta so'rovni BITTA tranzaksiyada bajaradi. Xato bo'lsa hammasi
 * bekor qilinadi (ROLLBACK) — pul bilan bog'liq amallarda shu majburiy.
 *
 *   await withTransaction(async (client) => {
 *     await client.query("UPDATE ...");
 *     await client.query("INSERT ...");
 *   });
 */
export async function withTransaction<T>(
  fn: (client: import("pg").PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Baza tirikligini tekshiradi (ishga tushishda va /healthz uchun). */
export async function pingDatabase(): Promise<void> {
  await pool.query("SELECT 1");
}

export async function closePool(): Promise<void> {
  await pool.end();
}
