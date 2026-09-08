/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESKI BOTDAN FOYDALANUVCHILARNI KO'CHIRISH (SQLite → PostgreSQL)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Eski bot ma'lumotlari `bot.db` (SQLite) faylida. Yangi platforma
 * PostgreSQL'da ishlaydi, shuning uchun foydalanuvchilar bir marta
 * ko'chiriladi.
 *
 * Ishlatish:
 *
 *     npm run import:sqlite -- /yo'l/bot.db
 *     npm run import:sqlite -- /yo'l/bot.db --zero-balance   # balanslarni 0 qilib
 *     npm run import:sqlite -- /yo'l/bot.db --dry-run        # faqat ko'rsatib chiqadi
 *
 * NIMA KO'CHADI: user_id, username, balans, referal ma'lumotlari,
 * ro'yxatdan o'tgan sana.
 *
 * NIMA KO'CHMAYDI: to'lovlar, buyurtmalar va navbatdagi tranzaksiyalar.
 * Ular eski botning tugallanmagan ishlari — yangi tizimda qayta
 * bajarilishi mumkin emas va xavfli bo'lardi.
 *
 * OFERTA: ko'chirilgan foydalanuvchilarda rozilik BELGILANMAYDI. Ular
 * botga birinchi kirganda ofertani o'qib rozilik beradi — huquqiy jihatdan
 * to'g'ri yo'l shu.
 *
 * XAVFSIZLIK: mavjud foydalanuvchining balansiga TEGILMAYDI. Skript ikki
 * marta ishga tushirilsa ham balans ikkilanmaydi (`ON CONFLICT DO NOTHING`
 * balans uchun).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

interface OldUser {
  user_id: number;
  username: string | null;
  balance: number;
  referrer_id: number | null;
  ref_earned: number;
  banned_until: number;
  created_at: number;
}

const SELECT_USERS =
  "SELECT user_id, username, balance, referrer_id, ref_earned, banned_until, created_at FROM users";

/**
 * Foydalanuvchilarni o'qiydi. Uch xil yo'l sinaladi, birinchi ishlagani olinadi:
 *
 *   1) .json fayl        — eng ishonchlisi, hech qanday bog'liqlik kerak emas
 *   2) node:sqlite       — Node 22+ ichida bor, qo'shimcha paket kerak emas
 *   3) `sqlite3` buyrug'i — eski Node uchun zaxira yo'l
 *
 * Loyihaga `sqlite3` npm paketi QO'SHILMAYDI: u faqat shu bir martalik
 * ko'chirish uchun kerak bo'lardi va ishlab chiqarishda umuman ishlatilmaydi.
 */
function readOldUsers(dbPath: string): OldUser[] {
  if (dbPath.endsWith(".json")) {
    const rows = JSON.parse(fs.readFileSync(dbPath, "utf-8")) as OldUser[];
    return clean(rows);
  }

  // Node 22+ da SQLite ichiga qurilgan.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const rows = db.prepare(SELECT_USERS).all() as unknown as OldUser[];
    db.close();
    return clean(rows);
  } catch (err) {
    if (!/Cannot find module|not supported/i.test((err as Error).message)) {
      throw new Error(`SQLite faylini o'qib bo'lmadi: ${(err as Error).message}`);
    }
  }

  // Zaxira: tizimdagi sqlite3 buyrug'i.
  try {
    const raw = execFileSync("sqlite3", ["-json", dbPath, `${SELECT_USERS};`], {
      encoding: "utf-8",
    });
    return clean(JSON.parse(raw || "[]") as OldUser[]);
  } catch (err) {
    throw new Error(
      `SQLite faylini o'qib bo'lmadi: ${(err as Error).message}\n\n` +
        `Yechim: Node 22 dan yuqorisini ishlating, yoki sqlite3 o'rnating\n` +
        `(Ubuntu: sudo apt install sqlite3), yoki .json ko'rinishini bering.`
    );
  }
}

function clean(rows: OldUser[]): OldUser[] {
  return rows.filter((r) => Number.isFinite(Number(r?.user_id)));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dbPath = args.find((a) => !a.startsWith("--"));
  const zeroBalance = args.includes("--zero-balance");
  const dryRun = args.includes("--dry-run");

  if (!dbPath) {
    console.error("Foydalanish: npm run import:sqlite -- /yo'l/bot.db [--zero-balance] [--dry-run]");
    process.exit(1);
  }
  if (!fs.existsSync(dbPath)) {
    console.error(`Fayl topilmadi: ${path.resolve(dbPath)}`);
    process.exit(1);
  }

  const users = readOldUsers(dbPath);
  const withBalance = users.filter((u) => Number(u.balance) > 0);
  const total = withBalance.reduce((n, u) => n + Number(u.balance), 0);

  console.log(`\n📦 Eski bazada ${users.length} ta foydalanuvchi`);
  console.log(`   balansi bor: ${withBalance.length} ta, jami ${total.toLocaleString("ru-RU")} so'm`);
  console.log(`   balanslar: ${zeroBalance ? "0 QILINADI" : "SAQLANADI"}`);

  if (dryRun) {
    for (const u of withBalance.sort((a, b) => b.balance - a.balance).slice(0, 20)) {
      console.log(`   ${u.user_id}  @${u.username ?? "—"}  ${Number(u.balance).toLocaleString("ru-RU")} so'm`);
    }
    console.log("\n(--dry-run: hech narsa yozilmadi)");
    return;
  }

  const { runMigrations } = await import("../src/db/migrate");
  const { pool, closePool } = await import("../src/db/pool");

  await runMigrations();

  let inserted = 0;
  let skipped = 0;
  const nowSec = Math.floor(Date.now() / 1000);

  for (const u of users) {
    const balance = zeroBalance ? 0 : Math.max(0, Math.round(Number(u.balance) || 0));

    // Mavjud foydalanuvchiga TEGILMAYDI: username yangilanadi, balans esa
    // o'z holicha qoladi. Shu sabab skriptni qayta ishga tushirish xavfsiz.
    // `xmax = 0` — PostgreSQL hiylasi: qator YANGI qo'shildimi yoki
    // mavjudi yangilandimi, shuni ajratib beradi. `rowCount` bunda
    // yaramaydi: DO UPDATE ham har doim bitta qator qaytaradi.
    const { rows: res } = await pool.query<{ is_new: boolean }>(
      `INSERT INTO users
         (user_id, username, balance, referrer_id, ref_earned, banned_until, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id) DO UPDATE
         SET username = COALESCE(EXCLUDED.username, users.username)
       RETURNING (xmax = 0) AS is_new`,
      [
        Number(u.user_id),
        u.username || null,
        balance,
        u.referrer_id ? Number(u.referrer_id) : null,
        Math.max(0, Math.round(Number(u.ref_earned) || 0)),
        Math.max(0, Math.round(Number(u.banned_until) || 0)),
        Math.round(Number(u.created_at) || nowSec),
      ]
    );

    if (res[0]?.is_new) inserted++;
    else skipped++;
  }

  // Ko'chirilgan balanslar `balance_ledger` da izsiz qolmasin: keyinchalik
  // "bu pul qayerdan keldi?" degan savolga javob shu yozuvda bo'ladi.
  if (!zeroBalance && withBalance.length > 0) {
    await pool.query(
      `INSERT INTO balance_ledger (user_id, delta, balance_after, reason, ref_id, created_at)
       SELECT u.user_id, u.balance, u.balance, 'admin', 'import:sqlite', $1
         FROM users u
        WHERE u.user_id = ANY($2::bigint[]) AND u.balance > 0
          AND NOT EXISTS (
            SELECT 1 FROM balance_ledger l
             WHERE l.user_id = u.user_id AND l.ref_id = 'import:sqlite'
          )`,
      [nowSec, withBalance.map((u) => Number(u.user_id))]
    );
  }

  const { rows } = await pool.query<{ count: number; total: number }>(
    "SELECT COUNT(*)::int AS count, COALESCE(SUM(balance), 0)::bigint AS total FROM users"
  );

  console.log(`\n✅ Ko'chirildi: ${inserted} ta yangi, ${skipped} ta allaqachon bor edi`);
  console.log(
    `   Bazada endi ${rows[0].count} ta foydalanuvchi, jami balans ` +
      `${Number(rows[0].total).toLocaleString("ru-RU")} so'm`
  );
  console.log(`   Oferta: hamma qaytadan rozilik beradi (botga kirganda so'raladi)\n`);

  await closePool();
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
