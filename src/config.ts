import "dotenv/config";

/**
 * Butun platformaning YAGONA sozlama nuqtasi.
 *
 * Yangi sozlama qo'shish uchun faqat ikki joyni tahrirlang:
 *   1. shu fayl (quyidagi `config` obyektiga bitta qator)
 *   2. `.env.example` (izohi bilan)
 * Boshqa hech qayerni o'zgartirish shart emas.
 */

const missing: string[] = [];

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    missing.push(name);
    return "";
  }
  return value.trim();
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : fallback;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? fallback : n;
}

function optionalFloat(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseFloat(raw);
  return Number.isNaN(n) ? fallback : n;
}

function optionalBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

function idList(name: string): number[] {
  return optional(name, "")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n));
}

/** Oxiridagi "/" ni olib tashlaydi, shunda URL yasashda ikkilanish bo'lmaydi. */
function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export const config = {
  // ---------- Telegram ----------
  botToken: required("BOT_TOKEN"),
  admins: idList("ADMIN_IDS"),
  supportBot: optional("SUPPORT_BOT", "https://t.me/HozirOIbot"),

  logChannelId: optionalInt("LOG_CHANNEL_ID", 0),
  paymentChannelId: optionalInt("PAYMENT_CHANNEL_ID", 0),
  adminChannelId: optionalInt("ADMIN_CHANNEL_ID", 0),

  // ---------- Server / Mini App ----------
  /** Mini App va webhook shu domendan ochiladi. Majburiy https. */
  publicUrl: trimSlash(optional("PUBLIC_URL", "")),
  port: optionalInt("PORT", 8080),
  /** Reverse proxy (nginx/Caddy) orqasida ishlaganda haqiqiy IP ni olish uchun. */
  trustProxy: optionalBool("TRUST_PROXY", true),
  /**
   * Har bir kiruvchi HTTP so'rovni jurnalga yozish.
   * "Serverga so'rov kelyaptimi?" degan savolga javob shu yerdan olinadi.
   * Juda katta yukda o'chirib qo'yish mumkin (LOG_REQUESTS=false).
   */
  logRequests: optionalBool("LOG_REQUESTS", true),

  /**
   * "webhook" — ishlab chiqarish uchun (bir nechta instance ishlatish mumkin).
   * "polling" — lokal ishlab chiqish uchun (domen shart emas).
   */
  botMode: optional("BOT_MODE", "polling") as "webhook" | "polling",
  /** Webhook URL yo'lidagi maxfiy qism — tashqi so'rovlarni to'sadi. */
  webhookSecret: optional("WEBHOOK_SECRET", ""),

  // ---------- PostgreSQL ----------
  databaseUrl: required("DATABASE_URL"),
  pgSsl: optionalBool("PGSSL", false),
  /**
   * Bitta process uchun pool hajmi. Bir nechta instance ishlatsangiz,
   * (instance soni × PG_POOL_MAX) PostgreSQL'ning max_connections dan
   * kichik bo'lishi kerak.
   */
  pgPoolMax: optionalInt("PG_POOL_MAX", 20),
  /** Osilib qolgan so'rov butun poolni bloklamasligi uchun. */
  pgStatementTimeoutMs: optionalInt("PG_STATEMENT_TIMEOUT_MS", 15_000),

  // ---------- Tashqi xizmatlar ----------
  marketAppApiToken: required("MARKETAPP_API_TOKEN"),
  marketAppApiBase: trimSlash(optional("MARKETAPP_API_BASE", "https://api.marketapp.org")),

  mnemonic: required("TON_MNEMONIC"),
  toncenterApiKey: optional("TONCENTER_API_KEY", ""),
  toncenterBaseUrl: trimSlash(optional("TONCENTER_BASE_URL", "https://toncenter.com/api/v2")),

  // GramJS — faqat "📱 Telegram profil" bo'limi uchun (my.telegram.org).
  tgApiId: optionalInt("TG_API_ID", 0),
  tgApiHash: optional("TG_API_HASH", ""),

  // ---------- To'lov ----------
  cardOwner: optional("CARD_OWNER", ""),
  cardNumber: optional("CARD_NUMBER", ""),
  paymentReceiptSamplePhoto: optional("PAYMENT_RECEIPT_SAMPLE_PHOTO", ""),
  paymentWindowSec: optionalInt("PAYMENT_WINDOW_SEC", 15 * 60),
  banTimeSec: optionalInt("BAN_TIME_SEC", 60 * 60),
  minPayment: optionalInt("MIN_PAYMENT", 10_000),
  refPercent: optionalFloat("REF_PERCENT", 0.005),

  // ---------- Stars / Premium ----------
  starMin: optionalInt("STAR_MIN", 50),
  starMax: optionalInt("STAR_MAX", 5000),
  txDelaySec: optionalInt("TX_DELAY_SEC", 10),
  maxRetries: optionalInt("MAX_RETRIES", 3),
  itemsPerPage: optionalInt("ITEMS_PER_PAGE", 10),

  // ---------- Gift Arenda ----------
  /**
   * Butun katalog shu davrda bir marta to'liq qayta o'qiladi (soniya).
   *
   * `/v1/rent/gifts/` kolleksiya filtrisiz hamma giftni ~100 tadan sahifalab
   * beradi, ya'ni ~8000 gift = ~80 so'rov. Shuning uchun to'liq yangilanish
   * bir necha daqiqada bo'ladi va band qilingan giftlar ro'yxatda uzoq
   * turib qolmaydi.
   */
  marketSweepSec: optionalInt("MARKET_SWEEP_SEC", 240),
  /**
   * Marketapp'ga ikkita so'rov orasidagi eng kam vaqt (ms).
   * 429 kelsa bu qiymat avtomatik oshadi, keyin asta-sekin qaytadi.
   */
  marketMinIntervalMs: optionalInt("MARKET_MIN_INTERVAL_MS", 1200),
  /** Kolleksiyalar RO'YXATI shu davrda bir marta qayta o'qiladi (soniya). */
  marketCollectionsRefreshSec: optionalInt("MARKET_COLLECTIONS_REFRESH_SEC", 900),
  /** Kolleksiya ma'lumoti shu muddatdan eski bo'lsa "eskirgan" hisoblanadi. */
  marketStaleSec: optionalInt("MARKET_STALE_SEC", 3600),
  /** Mini App bitta so'rovda nechta gift oladi. */
  marketPageSize: optionalInt("MARKET_PAGE_SIZE", 60),
  /** Ilova ichida o'ynatiladigan QISQA video (.mp4/.webm to'g'ridan-to'g'ri havolasi). */
  /**
   * Serverdagi video fayl nomi. `miniapp/media/` ichidan izlanadi va
   * `/app/media/<nom>` sifatida beriladi — tashqi saytga bog'liqlik yo'q.
   */
  profileLinkVideoFile: optional("PROFILE_LINK_VIDEO_FILE", "guide.mp4"),
  /** Fayl topilmasa ishlatiladigan tashqi havola (ixtiyoriy). */
  profileLinkVideoUrl: optional("PROFILE_LINK_VIDEO_URL", ""),
  /** "Batafsil" tugmasi — to'liq YouTube qo'llanmasi. */
  profileLinkYoutubeUrl: optional("PROFILE_LINK_YOUTUBE_URL", ""),

  // ---------- Mini App API himoyasi ----------
  /** initData shu muddatdan eski bo'lsa qabul qilinmaydi (soniya). */
  initDataMaxAgeSec: optionalInt("INITDATA_MAX_AGE_SEC", 6 * 60 * 60),
  /** Bitta foydalanuvchi uchun daqiqasiga ruxsat etilgan API so'rovlar soni. */
  apiRateLimitPerMin: optionalInt("API_RATE_LIMIT_PER_MIN", 240),
};

export function isAdmin(userId: number): boolean {
  return config.admins.includes(userId);
}

/** Mini App manzili (bot tugmasi shu URL ni ochadi). */
export function miniAppUrl(): string {
  return `${config.publicUrl}/app`;
}

/**
 * Ishga tushishdan oldin sozlamalarni tekshiradi. Xato bo'lsa DARHOL to'xtaydi —
 * yarim sozlangan bot bilan ishlagandan ko'ra, aniq xabar bilan to'xtash yaxshi.
 */
export function validateConfig(): void {
  const errors = [...missing.map((n) => `.env da "${n}" topilmadi yoki bo'sh`)];

  if (config.admins.length === 0) {
    errors.push("ADMIN_IDS bo'sh — admin panelga hech kim kira olmaydi");
  }

  if (config.botMode !== "webhook" && config.botMode !== "polling") {
    errors.push(`BOT_MODE noto'g'ri: "${config.botMode}" (faqat "webhook" yoki "polling")`);
  }

  if (config.botMode === "webhook") {
    if (!config.publicUrl) {
      errors.push("BOT_MODE=webhook bo'lsa PUBLIC_URL majburiy");
    }
    if (!config.webhookSecret || config.webhookSecret.length < 16) {
      errors.push("WEBHOOK_SECRET kamida 16 ta belgidan iborat bo'lishi kerak");
    }
  }

  if (config.publicUrl && !config.publicUrl.startsWith("https://")) {
    errors.push("PUBLIC_URL https:// bilan boshlanishi shart (Telegram Mini App talabi)");
  }

  const mnemonicWords = config.mnemonic.trim().split(/\s+/).filter(Boolean);
  if (config.mnemonic && mnemonicWords.length !== 24) {
    errors.push(`TON_MNEMONIC 24 ta so'zdan iborat bo'lishi kerak (hozir ${mnemonicWords.length} ta)`);
  }

  if (errors.length > 0) {
    console.error("\n❌ Sozlamalarda xatolik:\n");
    for (const e of errors) console.error(`   • ${e}`);
    console.error("\n   .env.example faylidan nusxa oling: cp .env.example .env\n");
    process.exit(1);
  }
}

/**
 * Bot username'i. Ishga tushishda `bot.init()` dan keyin bir marta yoziladi —
 * Mini App undan `t.me/<bot>?start=pay` deeplinkini yasaydi.
 */
let cachedBotUsername = "";

export function setBotUsername(name: string): void {
  cachedBotUsername = name;
}

export function botUsername(): string {
  return cachedBotUsername;
}
