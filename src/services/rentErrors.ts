/**
 * Texnik xatoni FOYDALANUVCHI TILIGA o'girish.
 *
 * Nega kerak: avval Mini App'da xatoning xom matni turardi —
 *
 *   POST /v1/rent/EQBQ.../pay/ [400]: {"detail":{"status":"error",
 *   "reason":"Too late. It is not for rent anymore."}}
 *
 * Foydalanuvchi bundan hech narsa tushunmaydi, ustiga bu ichki manzillarni
 * ham ko'rsatib qo'yadi. Endi u faqat sodda, tushunarli jumlani ko'radi,
 * xom matn esa admin jurnalida va `rent_jobs.error_msg` da qoladi —
 * ya'ni nosozlikni izlash imkoniyati yo'qolmaydi.
 */

interface Rule {
  /** Xom xato matnida shu naqshlardan biri bo'lsa mos keladi. */
  match: RegExp;
  /** Foydalanuvchi ko'radigan jumla. */
  text: string;
  /**
   * Qayta urinishdan foyda bormi? Masalan "gift band" — yo'q, hech qachon
   * o'zgarmaydi; tarmoq uzilishi — ha, birozdan keyin o'tishi mumkin.
   */
  retry: boolean;
}

const RULES: Rule[] = [
  {
    // "Too late. It is not for rent anymore."
    match: /not for rent|too late|already rented|no longer available|not available/i,
    text: "Bu giftni sizdan oldin boshqa kimdir ijaraga olib ulgurdi.",
    retry: false,
  },
  {
    match: /not found|does not exist|404/i,
    text: "Bu gift marketdan olib tashlangan.",
    retry: false,
  },
  {
    match: /min_duration|max_duration|duration|invalid days|out of range/i,
    text: "Tanlangan muddat bu gift uchun to'g'ri kelmadi.",
    retry: false,
  },
  {
    match: /insufficient|not enough (ton|balance|funds)|balance is too low/i,
    text: "Xizmat hamyonida vaqtincha mablag' yetmadi. Adminlar xabardor qilindi.",
    retry: false,
  },
  {
    match: /price (changed|mismatch)|different price/i,
    text: "Giftning narxi shu orada o'zgarib ketdi.",
    retry: false,
  },
  {
    match: /timeout|timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|socket hang up|network/i,
    text: "Tarmoqda vaqtinchalik uzilish bo'ldi.",
    retry: true,
  },
  {
    match: /429|too many requests|rate limit/i,
    text: "Market hozir juda band. Birozdan keyin qayta uriniladi.",
    retry: true,
  },
  {
    match: /50\d|bad gateway|service unavailable|internal server error/i,
    text: "Market serverida vaqtinchalik nosozlik.",
    retry: true,
  },
];

const FALLBACK = "Texnik nosozlik tufayli amalga oshmadi.";

/** Foydalanuvchiga ko'rsatiladigan sabab (xom matn HECH QACHON emas). */
export function userFacingRentError(raw: string): string {
  const rule = RULES.find((r) => r.match.test(raw));
  return rule ? rule.text : FALLBACK;
}

/**
 * Bu xatoni qayta urinib ko'rishdan ma'no bormi?
 *
 * "Gift allaqachon band" kabi xatolarda uch marta urinib, orada 10-40
 * soniya kutish — foydalanuvchini bekorga kuttirish. Bunday holatda pul
 * DARHOL qaytariladi.
 *
 * Noma'lum xato — urinib ko'ramiz: u vaqtinchalik bo'lishi mumkin.
 */
export function isRetryableRentError(raw: string): boolean {
  const rule = RULES.find((r) => r.match.test(raw));
  return rule ? rule.retry : true;
}

/**
 * Bazada ALLAQACHON yotgan xatolarni ham tozalab beradi.
 *
 * Bu o'zgarishdan oldin yaratilgan ijaralarda `tx_error` xom matn bo'lib
 * qolgan. Ularni bazada tuzatib chiqishning hojati yo'q — Mini App'ga
 * yuborishdan oldin shu yerda tekshiriladi.
 *
 * Faqat TEXNIK ko'ringan matn almashtiriladi: agar u allaqachon sodda
 * jumla bo'lsa (ya'ni yuqoridagi qoidalardan biri yozgan bo'lsa), tegilmaydi.
 */
export function sanitizeStoredRentError(raw: string | null): string | null {
  if (!raw) return null;

  const looksTechnical =
    /https?:\/\/|\/v1\/|[{}]|\[\d{3}\]|\b(?:GET|POST|PUT|DELETE)\b|Error:|"detail"/.test(raw);

  return looksTechnical ? userFacingRentError(raw) : raw;
}
