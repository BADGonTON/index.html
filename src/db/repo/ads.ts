import { pool } from "../pool";
import type { AdPlacement, AdStatus, TelegramAd } from "../../services/telegramAds";

/**
 * Reklamalar repozitoriysi.
 *
 * Telegram tomonda hisob BITTA — bizniki. Reklama kimniki ekani faqat shu
 * yerda yoziladi, shuning uchun HAR BIR o'qish `user_id` bo'yicha
 * cheklanadi: `getUserAd` boshqa odamning reklamasini hech qachon
 * qaytarmaydi. Aks holda foydalanuvchi `ad_id` ni taxmin qilib birovning
 * reklamasini o'chira olardi.
 */

export interface AdRow {
  id: number;
  user_id: number;
  tg_ad_id: number | null;
  title: string;
  text: string;
  promote_url: string;
  placement: AdPlacement;
  status: AdStatus | "draft";
  decline_reason: string | null;
  cpm_ton: number;
  budget_ton: number;
  spent_ton: number;
  views: number;
  clicks: number;
  actions: number;
  error_msg: string | null;
  created_at: number;
  synced_at: number;
}

export interface AdTopupRow {
  id: number;
  ad_id: number;
  user_id: number;
  uzs: number;
  ton: number;
  fee_uzs: number;
  idempotency_key: string;
  status: "pending" | "done" | "failed" | "refunded";
  error_msg: string | null;
  created_at: number;
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

/** NUMERIC ustunlar pg'dan SATR bo'lib keladi — sonlarga o'giramiz. */
function toAdRow(raw: Record<string, unknown>): AdRow {
  return {
    ...(raw as unknown as AdRow),
    cpm_ton: Number(raw.cpm_ton ?? 0),
    budget_ton: Number(raw.budget_ton ?? 0),
    spent_ton: Number(raw.spent_ton ?? 0),
    views: Number(raw.views ?? 0),
    clicks: Number(raw.clicks ?? 0),
    actions: Number(raw.actions ?? 0),
    tg_ad_id: raw.tg_ad_id === null ? null : Number(raw.tg_ad_id),
  };
}

function toTopupRow(raw: Record<string, unknown>): AdTopupRow {
  return {
    ...(raw as unknown as AdTopupRow),
    uzs: Number(raw.uzs ?? 0),
    ton: Number(raw.ton ?? 0),
    fee_uzs: Number(raw.fee_uzs ?? 0),
  };
}

// ───────────────────────── Reklama yozuvi ─────────────────────────

/**
 * Reklamani BAZAGA yozadi — Telegramga hali bormaymiz.
 *
 * Tartib ataylab shunday: avval yozuv, keyin API. Tarmoq uzilsa yoki
 * bot qayta ishga tushsa, yozuv `draft` holatida qoladi va foydalanuvchi
 * uni ko'radi. Teskarisi bo'lsa — Telegramda reklama bor, bizda yo'q:
 * u "egasiz" qolardi va hech kim uni boshqara olmasdi.
 */
export async function createAdDraft(input: {
  userId: number;
  title: string;
  text: string;
  promoteUrl: string;
  placement: AdPlacement;
}): Promise<AdRow> {
  const { rows } = await pool.query(
    `INSERT INTO ads (user_id, title, text, promote_url, placement, status, created_at)
     VALUES ($1, $2, $3, $4, $5, 'draft', $6)
     RETURNING *`,
    [input.userId, input.title, input.text, input.promoteUrl, input.placement, nowSec()]
  );
  return toAdRow(rows[0]);
}

/** Telegram reklamani yaratgach, uning `ad_id` sini biriktiradi. */
export async function attachTelegramAd(id: number, ad: TelegramAd): Promise<void> {
  await pool.query(
    `UPDATE ads
        SET tg_ad_id = $2, status = $3, cpm_ton = $4,
            budget_ton = $5, spent_ton = $6,
            views = $7, clicks = $8, actions = $9,
            decline_reason = $10, error_msg = NULL, synced_at = $11
      WHERE id = $1`,
    [
      id,
      ad.ad_id,
      ad.status,
      ad.cpm,
      ad.remaining_budget,
      ad.spent_budget,
      ad.views,
      ad.clicks ?? 0,
      ad.actions ?? 0,
      ad.decline_reason?.text ?? null,
      nowSec(),
    ]
  );
}

/** Telegramdan olingan yangi holatni keshga yozadi. */
export async function syncAdFromTelegram(ad: TelegramAd): Promise<void> {
  await pool.query(
    `UPDATE ads
        SET title = $2, text = $3, promote_url = $4, placement = $5,
            status = $6, cpm_ton = $7, budget_ton = $8, spent_ton = $9,
            views = $10, clicks = $11, actions = $12,
            decline_reason = $13, synced_at = $14
      WHERE tg_ad_id = $1`,
    [
      ad.ad_id,
      ad.title,
      ad.text ?? "",
      ad.promote_url,
      ad.placement,
      ad.status,
      ad.cpm,
      ad.remaining_budget,
      ad.spent_budget,
      ad.views,
      ad.clicks ?? 0,
      ad.actions ?? 0,
      ad.decline_reason?.text ?? null,
      nowSec(),
    ]
  );
}

export async function setAdError(id: number, message: string | null): Promise<void> {
  await pool.query("UPDATE ads SET error_msg = $2 WHERE id = $1", [id, message]);
}

export async function listUserAds(userId: number, limit = 100): Promise<AdRow[]> {
  const { rows } = await pool.query(
    "SELECT * FROM ads WHERE user_id = $1 ORDER BY id DESC LIMIT $2",
    [userId, limit]
  );
  return rows.map(toAdRow);
}

/**
 * Reklamani EGASI bo'yicha oladi.
 *
 * `user_id` shartsiz bo'lmagan versiyasi ataylab yo'q: har bir chaqiruv
 * egalikni tekshirishga majbur bo'lsin.
 */
export async function getUserAd(userId: number, id: number): Promise<AdRow | null> {
  const { rows } = await pool.query("SELECT * FROM ads WHERE id = $1 AND user_id = $2", [
    id,
    userId,
  ]);
  return rows.length > 0 ? toAdRow(rows[0]) : null;
}

export async function deleteAdRow(id: number): Promise<void> {
  await pool.query("DELETE FROM ads WHERE id = $1", [id]);
}

/** Fon yangilanishi uchun: eng eski sinxronlangan, Telegramda mavjud reklamalar. */
export async function listAdsToSync(limit: number, olderThanSec: number): Promise<AdRow[]> {
  const { rows } = await pool.query(
    `SELECT * FROM ads
      WHERE tg_ad_id IS NOT NULL
        AND synced_at < $1
        AND status <> 'draft'
      ORDER BY synced_at ASC
      LIMIT $2`,
    [nowSec() - olderThanSec, limit]
  );
  return rows.map(toAdRow);
}

export async function countUserAds(userId: number): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM ads WHERE user_id = $1",
    [userId]
  );
  return Number(rows[0]?.count ?? 0);
}

// ───────────────────────── Byudjet harakatlari ─────────────────────────

/**
 * Byudjet harakatini "kutilmoqda" holatida yozadi.
 *
 * `idempotency_key` UNIQUE: Telegramga ham shu kalit ketadi, shuning uchun
 * tarmoq uzilib qayta urinilganda na bizda ikkita yozuv, na Telegramda
 * ikkinchi to'lov paydo bo'ladi.
 */
export async function createTopup(input: {
  adId: number;
  userId: number;
  uzs: number;
  ton: number;
  feeUzs: number;
  idempotencyKey: string;
}): Promise<AdTopupRow> {
  const { rows } = await pool.query(
    `INSERT INTO ad_topups (ad_id, user_id, uzs, ton, fee_uzs, idempotency_key, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
     RETURNING *`,
    [input.adId, input.userId, input.uzs, input.ton, input.feeUzs, input.idempotencyKey, nowSec()]
  );
  return toTopupRow(rows[0]);
}

export async function finishTopup(
  id: number,
  status: AdTopupRow["status"],
  errorMsg?: string | null
): Promise<void> {
  await pool.query("UPDATE ad_topups SET status = $2, error_msg = $3 WHERE id = $1", [
    id,
    status,
    errorMsg ?? null,
  ]);
}

export async function listUserTopups(userId: number, limit = 50): Promise<AdTopupRow[]> {
  const { rows } = await pool.query(
    "SELECT * FROM ad_topups WHERE user_id = $1 ORDER BY id DESC LIMIT $2",
    [userId, limit]
  );
  return rows.map(toTopupRow);
}

/** Foydalanuvchi reklamaga jami qancha sarflagan (so'm). */
export async function totalSpentUzs(userId: number): Promise<number> {
  const { rows } = await pool.query<{ total: string | null }>(
    "SELECT SUM(uzs) AS total FROM ad_topups WHERE user_id = $1 AND status = 'done'",
    [userId]
  );
  return Number(rows[0]?.total ?? 0);
}
