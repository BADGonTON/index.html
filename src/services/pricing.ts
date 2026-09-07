import { getSetting, setSetting } from "../db/repo/settings";

/**
 * Narx sozlamalari (TON kursi va xizmat haqi) XOTIRADA saqlanadi.
 *
 * Nega? Mini App'da slayder tortilganda narx real vaqtda o'zgaradi. Agar har
 * safar bazaga borilsa, bitta foydalanuvchi bir necha o'nlab so'rov qilardi.
 * Endi qiymatlar xotirada, admin o'zgartirganda esa darhol yangilanadi.
 */

const NANO = 1_000_000_000;

let tonRateUzs = 20_000; // 1 TON necha so'm
let serviceFeeUzs = 2_000; // har bir ijara uchun bir martalik xizmat haqi

export async function loadPricing(): Promise<void> {
  const [rate, fee] = await Promise.all([getSetting("ton_rate_som"), getSetting("service_fee_som")]);

  if (rate === null) await setSetting("ton_rate_som", tonRateUzs);
  else tonRateUzs = Math.max(1, parseInt(rate, 10) || tonRateUzs);

  if (fee === null) await setSetting("service_fee_som", serviceFeeUzs);
  else serviceFeeUzs = Math.max(0, parseInt(fee, 10) || 0);
}

export function getTonRateUzs(): number {
  return tonRateUzs;
}

export function getServiceFeeUzs(): number {
  return serviceFeeUzs;
}

export async function setTonRateUzs(value: number): Promise<void> {
  tonRateUzs = value;
  await setSetting("ton_rate_som", value);
}

export async function setServiceFeeUzs(value: number): Promise<void> {
  serviceFeeUzs = value;
  await setSetting("service_fee_som", value);
}

// ---------------------------------------------------------------------------
//  Hisob-kitob
// ---------------------------------------------------------------------------

/**
 * nanoTON qiymatini so'mdagi kunlik narxga aylantiradi.
 *
 * nanoTON qiymati 2^53 dan katta bo'lishi mumkin, shuning uchun u loyiha
 * bo'ylab STRING sifatida yuritiladi va bu yerda BigInt orqali bo'linadi —
 * shundagina aniqlik yo'qolmaydi.
 */
export function pricePerDayUzs(pricePerDayNano: string | number): number {
  const nano = BigInt(String(pricePerDayNano).split(".")[0] || "0");
  const ton = Number(nano) / NANO;
  return Math.ceil(ton * tonRateUzs);
}

/** Ijara narxi (xizmat haqisiz). */
export function baseCostUzs(pricePerDayNano: string | number, days: number): number {
  return pricePerDayUzs(pricePerDayNano) * days;
}

/** Yangi ijara uchun to'liq narx = kunlik × kun + bir martalik xizmat haqi. */
export function totalCostUzs(pricePerDayNano: string | number, days: number): number {
  return baseCostUzs(pricePerDayNano, days) + serviceFeeUzs;
}

/** Uzaytirishda xizmat haqi olinmaydi. */
export function extendCostUzs(pricePerDayNano: string | number, days: number): number {
  return baseCostUzs(pricePerDayNano, days);
}

/** Balans shu gift uchun necha kunga yetadi (xizmat haqini hisobga olib). */
export function daysAffordable(pricePerDayNano: string | number, balanceUzs: number): number {
  const perDay = pricePerDayUzs(pricePerDayNano);
  if (perDay <= 0) return 0;
  const remaining = balanceUzs - serviceFeeUzs;
  if (remaining <= 0) return 0;
  return Math.floor(remaining / perDay);
}

/** Uzaytirish uchun balans necha kunga yetadi. */
export function daysAffordableExtend(pricePerDayNano: string | number, balanceUzs: number): number {
  const perDay = pricePerDayUzs(pricePerDayNano);
  if (perDay <= 0) return 0;
  return Math.floor(balanceUzs / perDay);
}

export function secToDays(sec: number | string): number {
  return Math.max(0, Math.floor(Number(sec || 0) / 86_400));
}

export function daysToSec(days: number): number {
  return Math.floor(days) * 86_400;
}
