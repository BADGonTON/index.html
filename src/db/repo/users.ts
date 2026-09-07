import type { PoolClient } from "pg";
import { pool, withTransaction } from "../pool";
import { UserRow } from "../types";

type Db = Pick<PoolClient, "query"> | typeof pool;

/**
 * Balans o'zgarishining sababi. Har bir o'zgarish `balance_ledger` ga
 * yoziladi — shu tufayli "pul qayerga ketdi?" degan savolga har doim
 * aniq javob bor (moliyaviy bot uchun majburiy).
 */
export type LedgerReason =
  | "topup"
  | "referral"
  | "admin"
  | "stars"
  | "premium"
  | "tg_profile"
  | "rent"
  | "rent_extend"
  | "refund";

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

async function writeLedger(
  db: Db,
  userId: number,
  delta: number,
  balanceAfter: number,
  reason: LedgerReason,
  refId?: string | number | null
): Promise<void> {
  await db.query(
    `INSERT INTO balance_ledger (user_id, delta, balance_after, reason, ref_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, delta, balanceAfter, reason, refId == null ? null : String(refId), nowSec()]
  );
}

export async function getUser(userId: number): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>("SELECT * FROM users WHERE user_id = $1", [userId]);
  return rows[0] ?? null;
}

/**
 * Foydalanuvchini bitta so'rovda yaratadi yoki mavjudini qaytaradi.
 * (Avvalgi versiyada bu 2-3 ta so'rov qilardi — issiq yo'lda ortiqcha yuk edi.)
 */
export async function getOrCreateUser(
  userId: number,
  username?: string | null,
  referrerId?: number | null
): Promise<UserRow> {
  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (user_id, username, referrer_id, created_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE
       SET username = COALESCE(EXCLUDED.username, users.username)
     RETURNING *`,
    [userId, username ?? null, referrerId ?? null, nowSec()]
  );
  return rows[0];
}

export async function getBalance(userId: number): Promise<number> {
  const { rows } = await pool.query<{ balance: number }>(
    "SELECT balance FROM users WHERE user_id = $1",
    [userId]
  );
  return rows[0]?.balance ?? 0;
}

/** Balansga qo'shadi (yoki manfiy son bilan ayiradi) va ledger'ga yozadi. */
export async function creditBalance(
  userId: number,
  amount: number,
  reason: LedgerReason,
  refId?: string | number | null
): Promise<number> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ balance: number }>(
      "UPDATE users SET balance = balance + $1 WHERE user_id = $2 RETURNING balance",
      [amount, userId]
    );
    if (rows.length === 0) return 0;
    await writeLedger(client, userId, amount, rows[0].balance, reason, refId);
    return rows[0].balance;
  });
}

/**
 * Balansni ATOMIK yechadi — faqat yetarli mablag' bo'lsagina.
 *
 * "Tekshirish + yechish" bitta SQL so'rovda bajariladi, shuning uchun
 * foydalanuvchi tugmani ikki marta tez bossa ham, yoki Mini App va bot
 * bir vaqtda so'rov yuborsa ham, balans ikki marta yechilmaydi va
 * hech qachon manfiy bo'lmaydi.
 *
 * Yetarli bo'lsa yangi balansni, aks holda `null` qaytaradi.
 */
export async function tryDeductBalance(
  userId: number,
  amount: number,
  reason: LedgerReason,
  refId?: string | number | null
): Promise<number | null> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ balance: number }>(
      `UPDATE users SET balance = balance - $1
       WHERE user_id = $2 AND balance >= $1
       RETURNING balance`,
      [amount, userId]
    );
    if (rows.length === 0) return null;
    await writeLedger(client, userId, -amount, rows[0].balance, reason, refId);
    return rows[0].balance;
  });
}

/** Muvaffaqiyatsiz amaldan keyin pulni qaytaradi. */
export async function refundBalance(
  userId: number,
  amount: number,
  refId?: string | number | null
): Promise<number> {
  return creditBalance(userId, amount, "refund", refId);
}

export async function addReferralBonus(userId: number, amount: number, refId?: string | number): Promise<void> {
  if (amount <= 0) return;
  await withTransaction(async (client) => {
    const { rows } = await client.query<{ balance: number }>(
      `UPDATE users SET balance = balance + $1, ref_earned = ref_earned + $1
       WHERE user_id = $2 RETURNING balance`,
      [amount, userId]
    );
    if (rows.length === 0) return;
    await writeLedger(client, userId, amount, rows[0].balance, "referral", refId);
  });
}

export async function banUser(userId: number, untilTimestamp: number): Promise<void> {
  await pool.query("UPDATE users SET banned_until = $1 WHERE user_id = $2", [untilTimestamp, userId]);
}

/** Ban holatini BITTA so'rovda qaytaradi (avval ikkita alohida so'rov edi). */
export async function getBanRemaining(userId: number): Promise<number> {
  const { rows } = await pool.query<{ remaining: number }>(
    `SELECT GREATEST(0, banned_until - EXTRACT(EPOCH FROM now())::BIGINT)::BIGINT AS remaining
     FROM users WHERE user_id = $1`,
    [userId]
  );
  return rows[0]?.remaining ?? 0;
}

export async function isUserBanned(userId: number): Promise<boolean> {
  return (await getBanRemaining(userId)) > 0;
}

export async function getTotalUsers(): Promise<number> {
  const { rows } = await pool.query<{ count: number }>("SELECT COUNT(*)::int AS count FROM users");
  return rows[0].count;
}

/**
 * Broadcast uchun foydalanuvchilarni SAHIFALAB o'qiydi.
 * 200 000 ta ID ni bir vaqtda RAMga yuklash o'rniga bo'lak-bo'lak olamiz.
 */
export async function getUserIdsAfter(afterId: number, limit: number): Promise<number[]> {
  const { rows } = await pool.query<{ user_id: number }>(
    "SELECT user_id FROM users WHERE user_id > $1 ORDER BY user_id ASC LIMIT $2",
    [afterId, limit]
  );
  return rows.map((r) => r.user_id);
}
