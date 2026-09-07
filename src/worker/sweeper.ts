import { config } from "../config";
import { expirePendingPayments } from "../db/repo/payments";
import { expireFinishedRentals } from "../db/repo/rentals";
import { banUser } from "../db/repo/users";
import { pruneOldSessions } from "../db/repo/sessions";
import { notifyUser } from "../services/logger";
import { PAYMENT_TIMEOUT } from "../bot/texts";

/**
 * Davriy tozalash ishlari. Har biri bazaga tayangan, shuning uchun bot qayta
 * ishga tushsa ham hech narsa "osilib" qolmaydi (avval bu setTimeout bilan
 * qilinardi va restartda yo'qolardi).
 *
 * Bir nechta instance ishlasa, bir xil ishni bir nechtasi bajarishi mumkin —
 * lekin barcha amallar idempotent (DELETE ... RETURNING / UPDATE ... WHERE),
 * shu sabab bu xavfsiz.
 */

const SWEEP_INTERVAL_MS = 60_000;
/** 30 kundan eski sessiyalar keraksiz — vaqtinchalik holat, tarix emas. */
const SESSION_TTL_SEC = 30 * 24 * 3600;

let timer: NodeJS.Timeout | null = null;

async function sweep(): Promise<void> {
  // 1. Muddati o'tgan to'lovlar: o'chiriladi, egasi ban qilinadi va xabardor bo'ladi.
  try {
    const expired = await expirePendingPayments();
    for (const p of expired) {
      await banUser(p.user_id, Math.floor(Date.now() / 1000) + config.banTimeSec);
      await notifyUser(p.user_id, PAYMENT_TIMEOUT);
    }
    if (expired.length > 0) console.log(`🧹 ${expired.length} ta muddati o'tgan to'lov bekor qilindi`);
  } catch (err) {
    console.error("Sweeper (to'lovlar) xatosi:", (err as Error).message);
  }

  // 2. Muddati tugagan ijaralar 'expired' bo'ladi.
  try {
    const count = await expireFinishedRentals();
    if (count > 0) console.log(`🧹 ${count} ta ijara muddati tugadi`);
  } catch (err) {
    console.error("Sweeper (ijaralar) xatosi:", (err as Error).message);
  }
}

/** Sessiya tozalash kamdan-kam kerak — soatiga bir marta. */
async function sweepSessions(): Promise<void> {
  try {
    const count = await pruneOldSessions(SESSION_TTL_SEC);
    if (count > 0) console.log(`🧹 ${count} ta eskirgan sessiya o'chirildi`);
  } catch (err) {
    console.error("Sweeper (sessiyalar) xatosi:", (err as Error).message);
  }
}

export function startSweeper(): void {
  sweep().catch(() => {});
  timer = setInterval(() => sweep().catch(() => {}), SWEEP_INTERVAL_MS);
  timer.unref();

  const hourly = setInterval(() => sweepSessions().catch(() => {}), 3600_000);
  hourly.unref();
}

export function stopSweeper(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
