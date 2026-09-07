import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config";

/**
 * Telegram Mini App `initData` ni tekshiradi.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
 *
 * Bu tekshiruv MAJBURIY: busiz istalgan kishi user_id ni o'zgartirib
 * boshqa birovning balansidan foydalanishi mumkin bo'lardi.
 */

export interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

/** Bot tokenidan olinadigan sekret kalit — bir marta hisoblanadi. */
let secretKeyCache: Buffer | null = null;
function secretKey(): Buffer {
  if (!secretKeyCache) {
    secretKeyCache = crypto.createHmac("sha256", "WebAppData").update(config.botToken).digest();
  }
  return secretKeyCache;
}

/** Vaqt bo'yicha hujumlarga (timing attack) qarshi taqqoslash. */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export function verifyInitData(initData: string): TelegramUser | null {
  if (!initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  // `signature` maydoni (Telegram'ning uchinchi tomon validatsiyasi uchun)
  // data-check-string ga KIRMAYDI.
  params.delete("signature");

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const computed = crypto.createHmac("sha256", secretKey()).update(dataCheckString).digest("hex");
  if (!safeEqualHex(computed, hash)) return null;

  // Eskirgan initData qabul qilinmaydi (o'g'irlangan havola cheksiz ishlamasin).
  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > config.initDataMaxAgeSec) return null;

  const userRaw = params.get("user");
  if (!userRaw) return null;

  try {
    const user = JSON.parse(userRaw) as TelegramUser;
    return typeof user?.id === "number" ? user : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
//  Middleware
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tgUser?: TelegramUser;
    }
  }
}

/**
 * `Authorization: tma <initData>` sarlavhasini tekshiradi va `req.tgUser` ni
 * to'ldiradi. Xato bo'lsa 401.
 */
export function requireTelegramAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("Authorization") ?? "";
  const initData = header.startsWith("tma ") ? header.slice(4) : header;

  const user = verifyInitData(initData);
  if (!user) {
    res.status(401).json({ error: "Avtorizatsiya xatosi. Ilovani Telegram orqali oching." });
    return;
  }

  req.tgUser = user;
  next();
}

// ---------------------------------------------------------------------------
//  Oddiy, xotirada ishlaydigan rate-limit
// ---------------------------------------------------------------------------

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<number, Bucket>();

// Eskirgan yozuvlarni tozalab turamiz — Map cheksiz o'smasligi uchun.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 60_000).unref();

/**
 * Bitta foydalanuvchi daqiqasiga API_RATE_LIMIT_PER_MIN martadan ko'p so'rov
 * yubora olmaydi. Bu bitta buzuq/yomon niyatli klient butun serverni
 * band qilib qo'yishining oldini oladi.
 */
export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const userId = req.tgUser?.id;
  if (!userId) return next();

  const now = Date.now();
  const bucket = buckets.get(userId);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(userId, { count: 1, resetAt: now + 60_000 });
    return next();
  }

  bucket.count++;
  if (bucket.count > config.apiRateLimitPerMin) {
    res
      .status(429)
      .json({ error: "Juda ko'p so'rov yuborildi. Bir daqiqadan keyin urinib ko'ring." });
    return;
  }

  next();
}
