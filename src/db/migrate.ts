import fs from "node:fs";
import path from "node:path";
import { pool } from "./pool";

/**
 * Oddiy, lekin ishonchli migratsiya tizimi.
 *
 * Bazaga yangi jadval/ustun kerak bo'lsa:
 *   1. src/db/migrations/ ichida "006_nimadir.sql" yarating (raqam ketma-ket).
 *   2. Botni qayta ishga tushiring — u avtomatik qo'llanadi.
 *
 * Har bir fayl FAQAT BIR MARTA qo'llanadi (schema_migrations kuzatib boradi),
 * shu sabab eski o'rnatilgan bazani ham ma'lumot yo'qotmasdan yangilaydi.
 *
 * Bir nechta instance bir vaqtda ko'tarilsa, pg_advisory_lock ularni navbatga
 * qo'yadi — migratsiya ikki marta ishlamaydi.
 */
const MIGRATION_LOCK_ID = 947_112_003;

function migrationsDir(): string {
  return path.join(__dirname, "migrations");
}

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename    TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const files = fs
      .readdirSync(migrationsDir())
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const { rows } = await client.query<{ filename: string }>(
      "SELECT filename FROM schema_migrations"
    );
    const applied = new Set(rows.map((r) => r.filename));

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(migrationsDir(), file), "utf-8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`✅ Migratsiya qo'llanildi: ${file}`);
        count++;
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        console.error(`❌ Migratsiya xatosi (${file}):`, (err as Error).message);
        throw err;
      }
    }

    if (count === 0) console.log("✅ Baza allaqachon eng so'nggi holatda");
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]).catch(() => {});
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(async () => {
      console.log("🎉 Barcha migratsiyalar yakunlandi");
      await pool.end();
      process.exit(0);
    })
    .catch(async () => {
      await pool.end().catch(() => {});
      process.exit(1);
    });
}
