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

/**
 * Reklama byudjetiga qo'shiladigan ustama (%).
 *
 * Foydalanuvchi so'mda to'laydi, biz TON ga o'girib Telegram byudjetiga
 * qo'yamiz. Ustama shu o'rtadagi xizmat uchun — kurs tebranishini ham,
 * bizning ishimizni ham qoplaydi.
 */
let adsMarkupPct = 15;

/**
 * Reklamaga eng kam to'ldirish — TON da.
 *
 * Nega so'mda emas: Telegram byudjetni TON da oladi va uning o'z eng kam
 * chegarasi bor. So'mda saqlasak, kurs o'zgargan kuni chegara Telegramning
 * talabidan pastga tushib qolardi va reklama yaratilmasdi.
 */
let adsMinTon = 1;

/**
 * Eng kam CPM (1000 ko'rsatish narxi, TON).
 *
 * Telegram aniq raqamni API orqali BERMAYDI — hujjatda faqat "eng kam
 * qiymat hisob valyutasi va reklama parametrlariga bog'liq" deyilgan.
 * Lekin o'sha hujjat qo'shimcha narxlarni FOIZDA aytadi, shuning uchun
 * baho shu foizlardan yig'iladi. Telegram baribir rad etsa, uning O'Z
 * sababi ko'rsatiladi — bu baho taxmin ekani yashirilmaydi.
 */
let adsMinCpmTon = 0.1;

export async function loadPricing(): Promise<void> {
  const [rate, fee, minDays, extFee, adsMarkup, adsMinTonRaw, adsMinCpmRaw] = await Promise.all([
    getSetting("ton_rate_som"),
    getSetting("service_fee_som"),
    getSetting("extend_min_days"),
    getSetting("extend_fee_som"),
    getSetting("ads_markup_pct"),
    getSetting("ads_min_ton"),
    getSetting("ads_min_cpm_ton"),
  ]);

  if (rate === null) await setSetting("ton_rate_som", tonRateUzs);
  else tonRateUzs = Math.max(1, parseInt(rate, 10) || tonRateUzs);

  if (fee === null) await setSetting("service_fee_som", serviceFeeUzs);
  else serviceFeeUzs = Math.max(0, parseInt(fee, 10) || 0);

  if (minDays === null) await setSetting("extend_min_days", extendMinDays);
  else extendMinDays = Math.max(1, parseInt(minDays, 10) || extendMinDays);

  if (extFee === null) await setSetting("extend_fee_som", extendFeeUzs);
  else extendFeeUzs = Math.max(0, parseInt(extFee, 10) || 0);

  if (adsMarkup === null) await setSetting("ads_markup_pct", adsMarkupPct);
  else adsMarkupPct = Math.max(0, parseInt(adsMarkup, 10) || 0);

  if (adsMinTonRaw === null) await setSetting("ads_min_ton", adsMinTon);
  else adsMinTon = Math.max(0.01, parseFloat(adsMinTonRaw) || adsMinTon);

  if (adsMinCpmRaw === null) await setSetting("ads_min_cpm_ton", adsMinCpmTon);
  else adsMinCpmTon = Math.max(0.01, parseFloat(adsMinCpmRaw) || adsMinCpmTon);
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

// ═══════════════════════════════════════════════════════════════════════════
//  REKLAMA
// ═══════════════════════════════════════════════════════════════════════════

export function getAdsMarkupPct(): number {
  return adsMarkupPct;
}

export function getAdsMinTon(): number {
  return adsMinTon;
}

/**
 * Eng kam to'ldirish summasi SO'MDA.
 *
 * USTAMA HISOBGA OLINADI. Foydalanuvchi to'lagan summadan avval xizmat
 * haqi ayriladi, qolgani byudjetga tushadi. Shuning uchun "1 TON kerak"
 * degani "1 TON qiymatidagi so'm" emas:
 *
 *   1 TON = 20 000 so'm byudjetga
 *   ustama 15%  →  foydalanuvchi 23 000 so'm to'lashi kerak
 *
 * Ilgari bu hisobga olinmagan edi: 20 000 so'm to'lagan odamning
 * byudjetiga 0.86 TON tushib, Telegram reklamani rad etardi.
 */
export function getAdsMinTopupUzs(): number {
  const budgetUzs = adsMinTon * tonRateUzs;
  const totalUzs = (budgetUzs * (100 + adsMarkupPct)) / 100;
  // Yuqoriga yaxlitlaymiz — pastga yaxlitlansa chegaradan tushib qolardi.
  return Math.ceil(totalUzs / 1000) * 1000;
}

export function getAdsMinCpmBaseTon(): number {
  return adsMinCpmTon;
}

export async function setAdsMarkupPct(value: number): Promise<void> {
  adsMarkupPct = Math.max(0, Math.round(value));
  await setSetting("ads_markup_pct", adsMarkupPct);
}

export async function setAdsMinTon(value: number): Promise<void> {
  adsMinTon = Math.max(0.01, Math.round(value * 100) / 100);
  await setSetting("ads_min_ton", adsMinTon);
}

export async function setAdsMinCpmBaseTon(value: number): Promise<void> {
  adsMinCpmTon = Math.max(0.01, Math.round(value * 100) / 100);
  await setSetting("ads_min_cpm_ton", adsMinCpmTon);
}

/**
 * Reklama parametrlariga qarab ENG KAM CPM ni baholaydi.
 *
 * Hujjatdagi qo'shimchalar (Telegram Ads API, createAd):
 *
 *   • rasm      — "50-80% higher CPM"     → biz 80% ni olamiz
 *   • video     — "70-100% higher CPM"    → biz 100% ni olamiz
 *   • userpic   — "30% higher CPM"        → 30%
 *   • premium emoji — hujjatda foiz yo'q; amalda qimmatroq, shuning
 *     uchun asosni 0.1 dan 0.15 ga ko'taramiz
 *
 * Har doim YUQORI chegarani olamiz: past baho ko'rsatib, keyin Telegram
 * rad etgandan ko'ra, biroz yuqori aytib, o'tib ketgani yaxshiroq.
 */
export interface MinCpmInput {
  premiumEmoji?: boolean;
  photo?: boolean;
  video?: boolean;
  userpic?: boolean;
}

export function minCpmTon(opts: MinCpmInput = {}): number {
  let base = adsMinCpmTon;

  // Premium emoji asosni ko'taradi (0.10 → 0.15).
  if (opts.premiumEmoji) base = Math.max(base, Math.round(base * 1.5 * 100) / 100);

  let multiplier = 1;
  if (opts.video) multiplier *= 2.0;
  else if (opts.photo) multiplier *= 1.8;
  if (opts.userpic) multiplier *= 1.3;

  return Math.ceil(base * multiplier * 100) / 100;
}

/** Reklama byudjeti uchun narx hisobi. */
export interface AdsQuote {
  /** Foydalanuvchi to'laydigan umumiy summa (so'm). */
  total_uzs: number;
  /** Shundan Telegram byudjetiga ketadigan qismi (so'm). */
  budget_uzs: number;
  /** Shundan bizning ustamamiz (so'm). */
  fee_uzs: number;
  /** Telegram byudjetiga qo'yiladigan TON. */
  budget_ton: number;
}

/**
 * Foydalanuvchi to'lagan SO'M dan Telegram byudjetiga necha TON tushishini
 * hisoblaydi.
 *
 * Yo'nalish muhim: foydalanuvchi "50 000 so'mlik reklama" deydi, ya'ni
 * u to'laydigan summa ma'lum. Ustama SHU SUMMANING ICHIDAN olinadi —
 * ustidan emas. Aks holda ekranda bir narx, hisobda boshqa narx chiqardi.
 *
 *   total = 50 000, ustama 15%  →  ustama 6 522, byudjet 43 478
 *   (43 478 + 15% = 50 000)
 */
export function adsQuote(totalUzs: number): AdsQuote {
  const total = Math.max(0, Math.round(totalUzs));
  const budgetUzs = Math.round((total * 100) / (100 + adsMarkupPct));
  const feeUzs = total - budgetUzs;

  // TON aniqligi: Telegram byudjet uchun 2 xona qabul qiladi (Currencies
  // jadvalidagi "cpm & budget precision"). Pastga yaxlitlaymiz — shunda
  // hech qachon hisobdagidan ko'proq TON so'ramaymiz.
  const budgetTon = Math.floor((budgetUzs / tonRateUzs) * 100) / 100;

  return { total_uzs: total, budget_uzs: budgetUzs, fee_uzs: feeUzs, budget_ton: budgetTon };
}

/** TON summasini so'mga o'giradi (ko'rsatish uchun). */
export function tonToUzs(ton: number): number {
  return Math.round(ton * tonRateUzs);
}

/**
 * So'mni TON ga o'giradi.
 *
 * Foydalanuvchi HAMMA joyda so'mda ishlaydi — TON faqat Telegram API si
 * talab qilgani uchun, chegarada bir marta ishlatiladi.
 *
 * Yuqoriga yaxlitlanadi: Telegram byudjet va CPM uchun 2 xona qabul
 * qiladi, pastga yaxlitlasak eng kam chegaradan pastga tushib qolardik.
 */
export function uzsToTon(uzs: number): number {
  return Math.ceil((uzs / tonRateUzs) * 100) / 100;
}

/** Eng kam CPM — SO'MDA (foydalanuvchi shu birlikni ko'radi). */
export function minCpmUzs(opts: MinCpmInput = {}): number {
  // Yuqoriga, YUZGA yaxlitlaymiz.
  //
  // Mingga yaxlitlash rasm (3 600) va video (4 000) narxini tenglashtirib
  // qo'yardi — foydalanuvchi videoning qimmatroq ekanini ko'rmasdi.
  // Yuqoriga yaxlitlash esa Telegram chegarasidan pastga tushmaslikni
  // kafolatlaydi.
  return Math.ceil((minCpmTon(opts) * tonRateUzs) / 100) * 100;
}
