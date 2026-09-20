import { AdsApiError, AdsNotConfiguredError } from "./telegramAds";

/**
 * Telegram Ads xatosini FOYDALANUVCHI TILIGA o'girish.
 *
 * Telegram `AD_TITLE_REQUIRED`, `NOT_ENOUGH_BUDGET` kabi mashina kalitlarini
 * qaytaradi. Ular jurnal uchun qimmatli, lekin foydalanuvchi ekranida
 * turishi kerak emas — Gift Arenda bo'limida aynan shunday xom matn
 * chiqib, muammo bo'lgan edi (`rentErrors.ts` ga qarang).
 *
 * Bu yerdagi qoida bir xil: foydalanuvchi sodda jumla ko'radi, xom kalit
 * esa admin jurnaliga yoziladi.
 */

interface Rule {
  match: RegExp;
  text: string;
}

const RULES: Rule[] = [
  // ── Mablag' ──
  {
    match: /NOT_ENOUGH_BUDGET|INSUFFICIENT/i,
    text: "Reklama hisobida mablag' yetmadi. Balansni to'ldiring.",
  },
  {
    match: /BUDGET_TOO_SMALL|AMOUNT_TOO_SMALL|MIN_BUDGET/i,
    text: "Byudjet juda kichik — summani oshiring.",
  },
  {
    match: /CPM_TOO_SMALL|CPM_INVALID|MIN_CPM/i,
    text: "CPM narxi juda past. Telegram bu targeting uchun kattaroq narx talab qiladi.",
  },

  // ── Matn va sarlavha ──
  {
    match: /AD_TITLE_REQUIRED|TITLE_EMPTY/i,
    text: "Sarlavha bo'sh qolmasin.",
  },
  {
    match: /AD_TITLE_TOO_LONG|TITLE_TOO_LONG/i,
    text: "Sarlavha juda uzun — 128 belgidan oshmasin.",
  },
  {
    match: /AD_TEXT_REQUIRED|TEXT_EMPTY/i,
    text: "Reklama matnini yozing.",
  },
  {
    match: /AD_TEXT_TOO_LONG|TEXT_TOO_LONG/i,
    text: "Reklama matni juda uzun — 160 belgidan oshmasin.",
  },

  // ── Havola ──
  {
    match: /URL_INVALID|PROMOTE_URL|INVALID_URL/i,
    text: "Havola noto'g'ri. To'liq manzilni yozing (https:// bilan).",
  },
  {
    match: /WEBSITE_NAME_REQUIRED/i,
    text: "Tashqi havola uchun sayt nomini ham yozing.",
  },

  // ── Targeting ──
  {
    match: /CHANNEL_ID_UNKNOWN|CHANNEL_NOT_FOUND|CHANNEL_INVALID/i,
    text: "Kanal topilmadi. Username'ni @ bilan to'g'ri yozganingizni tekshiring.",
  },
  {
    match: /BOT_ID_UNKNOWN|BOT_NOT_FOUND|BOT_INVALID/i,
    text: "Bot topilmadi. Username'ni @ bilan to'g'ri yozganingizni tekshiring.",
  },
  {
    match: /TOO_MANY_CHANNELS|CHANNELS_TOO_MUCH/i,
    text: "Kanallar juda ko'p — eng ko'pi 100 ta.",
  },
  {
    match: /TOO_MANY_TOPICS|TOPICS_TOO_MUCH/i,
    text: "Mavzular juda ko'p — eng ko'pi 20 ta.",
  },
  {
    match: /TARGET_INVALID|TARGET_REQUIRED|TARGET_EMPTY/i,
    text: "Targeting sozlamasi to'liq emas.",
  },
  {
    match: /COUNTRY_INVALID|COUNTRY_REQUIRED/i,
    text: "Kamida bitta davlat tanlang.",
  },
  {
    match: /LANGUAGE_INVALID|TOO_MANY_LANGUAGES/i,
    text: "Tillar noto'g'ri tanlangan — eng ko'pi 8 ta.",
  },

  // ── Holat ──
  {
    match: /AD_NOT_FOUND|NOT_FOUND/i,
    text: "Bu reklama topilmadi — o'chirilgan bo'lishi mumkin.",
  },
  {
    match: /AD_IS_ACTIVE|MUST_BE_INACTIVE|AD_NOT_STOPPED/i,
    text: "Avval reklamani to'xtating va 10 daqiqa kuting.",
  },
  {
    match: /WRONG_STATUS|INVALID_STATUS|NOT_READY_FOR_REVIEW/i,
    text: "Reklama bu amal uchun mos holatda emas.",
  },

  // ── Idempotentlik ──
  {
    match: /IDEMPOTENT_REQUEST_IN_PROGRESS/i,
    text: "Avvalgi so'rovingiz hali bajarilyapti. Bir lahza kuting.",
  },
  {
    match: /IDEMPOTENT_PARAM_MISMATCH/i,
    text: "So'rov takrorlandi, lekin ma'lumotlar o'zgargan. Qaytadan urinib ko'ring.",
  },

  // ── Ruxsat va tarmoq ──
  {
    match: /UNAUTHORIZED|FORBIDDEN|TOKEN|HTTP_40[13]/i,
    text: "Reklama xizmatiga ulanib bo'lmadi. Adminlar xabardor qilindi.",
  },
  {
    match: /HTTP_5\d\d|TIMEOUT|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|socket hang up|network/i,
    text: "Reklama xizmati vaqtincha javob bermayapti. Birozdan keyin urinib ko'ring.",
  },
  {
    match: /429|TOO_MANY_REQUESTS|FLOOD/i,
    text: "Juda ko'p so'rov yuborildi. Bir daqiqadan keyin urinib ko'ring.",
  },
];

const FALLBACK = "Reklamani bajarib bo'lmadi. Birozdan keyin urinib ko'ring.";

/**
 * Xatoni foydalanuvchi ko'radigan jumlaga o'giradi.
 *
 * Kafolat: natijada hech qachon manzil, kalit yoki JSON bo'lmaydi.
 */
export function userFacingAdsError(err: unknown): string {
  if (err instanceof AdsNotConfiguredError) {
    return "Reklama bo'limi hozircha sozlanmagan.";
  }

  const raw =
    err instanceof AdsApiError
      ? err.code
      : err instanceof Error
        ? err.message
        : String(err ?? "");

  for (const rule of RULES) {
    if (rule.match.test(raw)) return rule.text;
  }
  return FALLBACK;
}

/**
 * Jurnal uchun xom matn — FOYDALANUVCHIGA EMAS, adminlar kanaliga.
 * Nosozlikni izlash imkoniyati yo'qolmasligi uchun kerak.
 */
export function adsErrorForLog(err: unknown): string {
  if (err instanceof AdsApiError) return `${err.method} → ${err.code}`;
  if (err instanceof Error) return err.message;
  return String(err ?? "");
}
