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

/**
 * Uzaytirishning ENG KAM muddati (kun).
 *
 * Nega kerak: har bir uzaytirish blokcheynga alohida tranzaksiya yuboradi
 * va uning komissiyasi (gas) muddatga bog'liq emas — 1 kunga uzaytirish
 * ham, 30 kunga uzaytirish ham bir xil turadi. 1 kunlik uzaytirishda
 * tranzaksiya haqi ijara narxidan oshib ketishi mumkin, ya'ni har bir
 * bunday amal ZARAR keltiradi.
 *
 * Shuning uchun uzaytirish kamida shu muddatga bo'ladi.
 */
let extendMinDays = 7;

/**
 * Uzaytirish uchun xizmat haqi.
 *
 * Blokcheyn komissiyasini qoplaydi. Yangi ijaradagi `serviceFeeUzs` dan
 * alohida turadi — uzaytirish arzonroq amal, chunki gift allaqachon
 * profilga ulangan.
 */
let extendFeeUzs = 1_000;

export async function loadPricing(): Promise<void> {
  const [rate, fee, minDays, extFee] = await Promise.all([
    getSetting("ton_rate_som"),
    getSetting("service_fee_som"),
    getSetting("extend_min_days"),
    getSetting("extend_fee_som"),
  ]);

  if (rate === null) await setSetting("ton_rate_som", tonRateUzs);
  else tonRateUzs = Math.max(1, parseInt(rate, 10) || tonRateUzs);

  if (fee === null) await setSetting("service_fee_som", serviceFeeUzs);
  else serviceFeeUzs = Math.max(0, parseInt(fee, 10) || 0);

  if (minDays === null) await setSetting("extend_min_days", extendMinDays);
  else extendMinDays = Math.max(1, parseInt(minDays, 10) || extendMinDays);

  if (extFee === null) await setSetting("extend_fee_som", extendFeeUzs);
  else extendFeeUzs = Math.max(0, parseInt(extFee, 10) || 0);
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

export function getExtendMinDays(): number {
  return extendMinDays;
}

export async function setExtendMinDays(value: number): Promise<void> {
  extendMinDays = Math.max(1, value);
  await setSetting("extend_min_days", extendMinDays);
}

export function getExtendFeeUzs(): number {
  return extendFeeUzs;
}

export async function setExtendFeeUzs(value: number): Promise<void> {
  extendFeeUzs = Math.max(0, value);
  await setSetting("extend_fee_som", extendFeeUzs);
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

/**
 * Uzaytirish narxi = kunlik × kun + uzaytirish xizmat haqi.
 *
 * Xizmat haqi blokcheyn komissiyasini qoplaydi: har bir uzaytirish
 * alohida tranzaksiya, uning narxi esa muddatga bog'liq emas.
 */
export function extendCostUzs(pricePerDayNano: string | number, days: number): number {
  return baseCostUzs(pricePerDayNano, days) + extendFeeUzs;
}

/** Balans shu gift uchun necha kunga yetadi (xizmat haqini hisobga olib). */
export function daysAffordable(pricePerDayNano: string | number, balanceUzs: number): number {
  const perDay = pricePerDayUzs(pricePerDayNano);
  if (perDay <= 0) return 0;
  const remaining = balanceUzs - serviceFeeUzs;
  if (remaining <= 0) return 0;
  return Math.floor(remaining / perDay);
}

/** Uzaytirish uchun balans necha kunga yetadi (xizmat haqini hisobga olib). */
export function daysAffordableExtend(pricePerDayNano: string | number, balanceUzs: number): number {
  const perDay = pricePerDayUzs(pricePerDayNano);
  if (perDay <= 0) return 0;
  const remaining = balanceUzs - extendFeeUzs;
  if (remaining <= 0) return 0;
  return Math.floor(remaining / perDay);
}

export function secToDays(sec: number | string): number {
  return Math.max(0, Math.floor(Number(sec || 0) / 86_400));
}

export function daysToSec(days: number): number {
  return Math.floor(days) * 86_400;
}

// ---------------------------------------------------------------------------
//  Kolleksiya (to'plam) narxi
// ---------------------------------------------------------------------------

/** To'plam kamida shuncha kunga olinadi. */
export const BUNDLE_MIN_DAYS = 7;
/** Ruxsat etilgan to'plam o'lchamlari. */
export const BUNDLE_SIZES = [3, 6, 9, 12] as const;
/** To'plam uchun ustama (foizda). */
export const BUNDLE_MARKUP_PCT = 10;

export interface BundleQuote {
  days: number;
  count: number;
  /** Barcha giftlarning `days` kunlik ijarasi. */
  rent_uzs: number;
  /** Har bir gift uchun bir martalik xizmat haqi × giftlar soni. */
  fee_uzs: number;
  /** Ustamagacha bo'lgan summa. */
  subtotal_uzs: number;
  /** BUNDLE_MARKUP_PCT foizli ustama. */
  markup_uzs: number;
  /** Foydalanuvchi ko'radigan YAGONA narx. */
  total_uzs: number;
}

/**
 * To'plam narxi.
 *
 * Misol: 6 ta gift, 7 kun, jami 100 000 so'm (ijara + xizmat haqi) —
 * foydalanuvchiga 110 000 so'm ko'rsatiladi.
 *
 * Har bir gift alohida emas, faqat YAKUNIY summa ko'rsatiladi.
 */
export function bundleQuote(pricesNano: Array<string | number>, days: number): BundleQuote {
  const count = pricesNano.length;
  const rent = pricesNano.reduce<number>((sum, nano) => sum + baseCostUzs(nano, days), 0);
  const fee = serviceFeeUzs * count;
  const subtotal = rent + fee;
  const markup = Math.ceil((subtotal * BUNDLE_MARKUP_PCT) / 100);

  return {
    days,
    count,
    rent_uzs: rent,
    fee_uzs: fee,
    subtotal_uzs: subtotal,
    markup_uzs: markup,
    total_uzs: subtotal + markup,
  };
}
