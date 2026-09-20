import axios, { AxiosInstance } from "axios";
import FormData from "form-data";
import { randomUUID } from "node:crypto";
import { config } from "../config";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  TELEGRAM ADS API KLIENTI  (promoteapi.telegram.org)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Bitta REKLAMA BERUVCHI hisobi bor — bizniki. Foydalanuvchilar o'z
 * reklamalarini shu hisob ichida yaratadi, kimniki ekani esa bizning
 * bazamizda (`ads` jadvali) saqlanadi. Telegram har bir foydalanuvchiga
 * alohida hisob ochishni talab qilmaydi va `createAccount` kompaniya
 * ma'lumotlarini so'raydi — oddiy foydalanuvchidan buni olib bo'lmaydi.
 *
 * MUHIM QOIDALAR:
 *
 *  1. Javob HAR DOIM `{ok: true, result}` yoki `{ok: false, error}` ko'rinishida.
 *     HTTP holati 200 bo'lsa ham `ok: false` bo'lishi mumkin — shuning uchun
 *     tekshiruv holat kodiga emas, `ok` maydoniga qarab qilinadi.
 *
 *  2. Pul harakatlantiradigan har bir chaqiruv (byudjet oshirish, reklama
 *     yaratish) IDEMPOTENT kalit bilan ketadi. Tarmoq uzilsa va biz qayta
 *     yuborsak, Telegram bir xil kalitni ko'rib avvalgi javobni qaytaradi —
 *     pul ikki marta yechilmaydi. Kalit 24 soat yashaydi.
 *
 *  3. Barcha so'rovlar bitta navbatdan o'tadi. Telegram Ads API ning aniq
 *     chegarasi e'lon qilinmagan, shuning uchun ehtiyot bo'lamiz.
 */

// ───────────────────────────── Tiplar ─────────────────────────────

export type AdsCurrency = "EUR" | "TON" | "XTR";

export interface AdsAccount {
  account_id: string;
  title: string;
  currency: AdsCurrency;
  spent_budget: number;
  remaining_budget: number;
  ads_budget: number;
}

export type AdStatus =
  | "stopped"
  | "ready_for_review"
  | "in_review"
  | "declined"
  | "active"
  | "on_hold";

export type AdPlacement = "channel_post" | "bot_banner" | "search_result" | "video_banner";

export interface AdPhoto {
  photo_id: string;
  photo_url: string;
}

export interface AdVideo {
  video_id: string;
  video_url: string;
}

export interface DeclineReason {
  text: string;
  description_html: string;
}

export interface TelegramAd {
  ad_id: number;
  title: string;
  currency: AdsCurrency;
  text: string;
  photo?: AdPhoto;
  video?: AdVideo;
  promote_url: string;
  cpm: number;
  placement: AdPlacement;
  target?: unknown;
  impression_frequency?: number;
  website_name?: string;
  website_photo?: { photo_id: string; photo_url: string };
  button?: string;
  conversion_event_id?: string;
  additional_info?: string;
  show_userpic?: boolean;
  spent_budget: number;
  remaining_budget: number;
  daily_spent_budget?: number;
  daily_budget_limit?: number;
  views: number;
  opens?: number;
  clicks?: number;
  actions: number;
  action_type?: string;
  created_date: number;
  is_paused?: boolean;
  activate_date?: number;
  deactivate_date?: number;
  schedule?: AdSchedule;
  status: AdStatus;
  decline_reason?: DeclineReason;
}

export interface AdSchedule {
  week_hours_mask: number[];
  timezone?: number;
  use_viewer_timezone?: boolean;
}

export interface AdStatItem {
  from_time: number;
  to_time: number;
  views: number;
  opens: number;
  clicks: number;
  actions: number;
  currency: AdsCurrency;
  spent_budget: number;
}

export interface TargetLanguage {
  language_code: string;
  name: string;
}

export interface TargetTopic {
  topic_id: number;
  name: string;
}

export interface TargetCountry {
  country_code: string;
  name: string;
}

export interface TargetLocation {
  location_id: number;
  name: string;
  country_code?: string;
  region?: string;
}

export interface TargetChannel {
  channel_id: number;
  title?: string;
  username?: string;
  photo_url?: string;
}

export interface TargetBot {
  bot_id: number;
  title?: string;
  username?: string;
  photo_url?: string;
}

export interface Audience {
  audience_id: number;
  title: string;
  size: number;
  ads_count: number;
  created_date: number;
  updated_date: number;
}

export interface PixelEvent {
  event_id: string;
  title: string;
  type: string;
  status: "inactive" | "active";
  ads_count: number;
  created_date: number;
  last_triggered_date?: number;
  auto_created?: boolean;
  code_snippet?: string;
}

/** `createAd` / `editAd` uchun targeting. To'rt xil bo'lishi mumkin. */
export type InputAdTarget =
  | InputAdTargetChannels
  | InputAdTargetUsers
  | InputAdTargetBots
  | InputAdTargetSearch;

export interface InputAdTargetChannels {
  type: "channels";
  language_codes?: string[];
  topic_ids?: number[];
  exclude_topic_ids?: number[];
  channel_ids?: (number | string)[];
  exclude_channel_ids?: (number | string)[];
}

export interface InputAdTargetUsers {
  type: "users";
  country_codes: string[];
  location_ids?: number[];
  language_codes?: string[];
  topic_ids?: number[];
  intersect_topics?: boolean;
  exclude_topic_ids?: number[];
  channel_ids?: (number | string)[];
  exclude_channel_ids?: (number | string)[];
  audience_ids?: number[];
  exclude_audience_ids?: number[];
  device?: "ios" | "android" | "mobile" | "desktop";
  exclude_political_channels?: boolean;
  political_channels_only?: boolean;
}

export interface InputAdTargetBots {
  type: "bots";
  bot_ids?: (number | string)[];
}

export interface InputAdTargetSearch {
  type: "search";
  search_queries: string[];
}

export interface CreateAdInput {
  title: string;
  text?: string;
  promote_url: string;
  cpm: number;
  placement: AdPlacement;
  target: InputAdTarget;
  photo_id?: string;
  video_id?: string;
  impression_frequency?: number;
  website_name?: string;
  website_photo_id?: string;
  button?: string;
  conversion_event_id?: string;
  additional_info?: string;
  show_userpic?: boolean;
  initial_budget?: number;
  daily_budget_limit?: number;
  is_paused?: boolean;
  activate_date?: number;
  deactivate_date?: number;
  schedule?: AdSchedule | false;
}

// ───────────────────────── Xatolar ─────────────────────────

/**
 * Telegram Ads qaytargan xato.
 *
 * `code` — Telegramning mashina o'qiydigan kaliti (`AD_TITLE_REQUIRED`),
 * shuning uchun uni foydalanuvchiga KO'RSATMAYMIZ: `userFacingAdsError`
 * orqali o'zbekcha jumlaga o'giriladi.
 */
export class AdsApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly method: string
  ) {
    super(`${method}: ${code}`);
    this.name = "AdsApiError";
  }
}

/** Reklama bo'limi umuman sozlanmagan (token yo'q). */
export class AdsNotConfiguredError extends Error {
  constructor() {
    super("TG_ADS_TOKEN sozlanmagan");
    this.name = "AdsNotConfiguredError";
  }
}

export function isAdsConfigured(): boolean {
  return Boolean(config.tgAdsToken);
}

// ───────────────────────── HTTP ─────────────────────────

let clientRef: AxiosInstance | null = null;

function client(): AxiosInstance {
  if (!clientRef) {
    const http = require("node:http") as typeof import("node:http");
    const https = require("node:https") as typeof import("node:https");
    clientRef = axios.create({
      baseURL: config.tgAdsApiBase,
      timeout: 30_000,
      // `ok: false` ham 4xx bilan kelishi mumkin — javobni O'ZIMIZ tekshiramiz,
      // shuning uchun axios hech qanday holatda o'zi xato tashlamaydi.
      validateStatus: () => true,
      headers: { Authorization: `Bearer ${config.tgAdsToken}` },
      httpAgent: new http.Agent({ keepAlive: true, maxSockets: 32 }),
      httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 32 }),
    });
  }
  return clientRef;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * So'rovlar navbati.
 *
 * Telegram Ads API o'z chegarasini e'lon qilmagan. Katalog klientidagidek
 * murakkab moslashuvchi tizim bu yerda ortiqcha — reklama so'rovlari kam
 * va foydalanuvchi ularni KUTIB turadi. Shunchaki ikkita so'rov orasida
 * kichik tanaffus qoldiramiz va 429 kelganda kutamiz.
 */
const QUEUE = {
  tail: Promise.resolve(),
  nextAllowedAt: 0,
  minIntervalMs: 120,
};

function schedule<T>(fn: () => Promise<T>): Promise<T> {
  const result = QUEUE.tail.then(async () => {
    const wait = QUEUE.nextAllowedAt - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      return await fn();
    } finally {
      QUEUE.nextAllowedAt = Date.now() + QUEUE.minIntervalMs;
    }
  });
  QUEUE.tail = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

interface AdsResponse<T> {
  ok: boolean;
  result?: T;
  error?: string;
}

/** Javobni ochadi: `ok: false` bo'lsa `AdsApiError` tashlaydi. */
function unwrap<T>(method: string, status: number, data: unknown): T {
  const body = data as AdsResponse<T> | undefined;

  if (body && typeof body === "object" && "ok" in body) {
    if (body.ok && body.result !== undefined) return body.result;
    if (body.ok) return undefined as T;
    throw new AdsApiError(body.error || "UNKNOWN_ERROR", method);
  }

  // JSON emas (masalan proxy xatosi yoki HTML sahifa) — holat kodi bilan
  // tushunarli xato yasaymiz.
  throw new AdsApiError(`HTTP_${status}`, method);
}

/**
 * API chaqiruvi.
 *
 * `idempotent` true bo'lsa, kalit avtomatik qo'shiladi. Kalitni chaqiruvchi
 * ham berishi mumkin (masalan bitta foydalanuvchi amali bir necha marta
 * qayta urinilganda — o'sha kalit saqlanib qolishi kerak).
 */
async function call<T>(
  method: string,
  params: Record<string, unknown> = {},
  opts: { idempotencyKey?: string; retries?: number } = {}
): Promise<T> {
  if (!isAdsConfigured()) throw new AdsNotConfiguredError();

  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    // Massiv va obyekt maydonlari JSON-satr bo'lib ketishi kerak.
    payload[key] = typeof value === "object" && value !== null ? JSON.stringify(value) : value;
  }
  if (opts.idempotencyKey) payload.idempotency_key = opts.idempotencyKey;

  const attempts = opts.retries ?? 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= attempts; attempt++) {
    try {
      const res = await schedule(() => client().post(`/${method}`, payload));

      // 429 — biroz kutib qayta urinamiz.
      if (res.status === 429 && attempt < attempts) {
        const retryAfter = Number(res.headers?.["retry-after"]) || 2;
        console.warn(`⏳ Telegram Ads 429 (${method}) — ${retryAfter}s kutamiz`);
        await sleep(retryAfter * 1000);
        continue;
      }

      return unwrap<T>(method, res.status, res.data);
    } catch (err) {
      lastError = err;

      // Telegram javob bergan bo'lsa qayta urinish foydasiz: xato mantiqiy
      // (masalan sarlavha bo'sh). Faqat tarmoq uzilishida qayta urinamiz.
      if (err instanceof AdsApiError) throw err;
      if (attempt >= attempts) break;
      await sleep(400 * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Fayl yuklash — `multipart/form-data`, JSON emas. */
async function upload<T>(
  method: string,
  file: Buffer,
  filename: string,
  contentType: string
): Promise<T> {
  if (!isAdsConfigured()) throw new AdsNotConfiguredError();

  const form = new FormData();
  form.append("file", file, { filename, contentType });

  const res = await schedule(() =>
    client().post(`/${method}`, form, { headers: form.getHeaders() })
  );
  return unwrap<T>(method, res.status, res.data);
}

/** Pul harakatlantiradigan amallar uchun yangi idempotent kalit. */
export function newIdempotencyKey(): string {
  return randomUUID();
}

// ═══════════════════════════════════════════════════════════════════════════
//  HISOB
// ═══════════════════════════════════════════════════════════════════════════

export function getCurrentAccount(): Promise<AdsAccount> {
  return call<AdsAccount>("getCurrentAccount");
}

export function getAccountStats(
  fromTime: number,
  toTime: number,
  interval: 300 | 86400
): Promise<AdStatItem[]> {
  return call<AdStatItem[]>("getAccountStats", {
    from_time: fromTime,
    to_time: toTime,
    interval,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  REKLAMALAR
// ═══════════════════════════════════════════════════════════════════════════

export function createAd(input: CreateAdInput, idempotencyKey: string): Promise<TelegramAd> {
  return call<TelegramAd>(
    "createAd",
    { ...input, return_target: true },
    // Reklama yaratish PUL yechadi (initial_budget) — qayta urinishda
    // ikkinchi reklama paydo bo'lmasligi uchun kalit majburiy.
    { idempotencyKey, retries: 1 }
  );
}

export function editAd(
  adId: number,
  patch: Partial<CreateAdInput> & { is_paused?: boolean }
): Promise<TelegramAd> {
  return call<TelegramAd>("editAd", { ad_id: adId, ...patch, return_target: true });
}

export function getAdsById(adIds: number[]): Promise<TelegramAd[]> {
  if (adIds.length === 0) return Promise.resolve([]);
  return call<TelegramAd[]>("getAdsById", { ad_ids: adIds, return_target: true });
}

export function getAdsList(offset?: string, limit = 100): Promise<{
  total_count: number;
  ads: TelegramAd[];
  next_offset?: string;
}> {
  return call("getAdsList", { offset, limit, return_target: true });
}

export function increaseAdBudget(
  adId: number,
  amount: number,
  idempotencyKey: string
): Promise<TelegramAd> {
  return call<TelegramAd>(
    "increaseAdBudget",
    { ad_id: adId, amount, return_target: true },
    { idempotencyKey, retries: 1 }
  );
}

export function decreaseAdBudget(
  adId: number,
  amount: number,
  idempotencyKey: string
): Promise<TelegramAd> {
  return call<TelegramAd>(
    "decreaseAdBudget",
    { ad_id: adId, amount, return_target: true },
    { idempotencyKey, retries: 1 }
  );
}

export function submitAdForReview(adId: number): Promise<TelegramAd> {
  return call<TelegramAd>("submitAdForReview", { ad_id: adId, return_target: true });
}

export function deleteAd(adId: number): Promise<boolean> {
  return call<boolean>("deleteAd", { ad_id: adId });
}

export function getAdStats(
  adId: number,
  fromTime: number,
  toTime: number,
  interval: 300 | 86400
): Promise<AdStatItem[]> {
  return call<AdStatItem[]>("getAdStats", {
    ad_id: adId,
    from_time: fromTime,
    to_time: toTime,
    interval,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  FAYLLAR
// ═══════════════════════════════════════════════════════════════════════════

export function uploadAdPhoto(file: Buffer, filename: string, type: string): Promise<AdPhoto> {
  return upload<AdPhoto>("uploadAdPhoto", file, filename, type);
}

export function uploadAdVideo(file: Buffer, filename: string, type: string): Promise<AdVideo> {
  return upload<AdVideo>("uploadAdVideo", file, filename, type);
}

export function uploadWebsitePhoto(
  file: Buffer,
  filename: string,
  type: string
): Promise<{ photo_id: string; photo_url: string }> {
  return upload("uploadWebsitePhoto", file, filename, type);
}

// ═══════════════════════════════════════════════════════════════════════════
//  TARGETING MA'LUMOTNOMALARI
// ═══════════════════════════════════════════════════════════════════════════
//
// Bu ro'yxatlar deyarli o'zgarmaydi (tillar, davlatlar, mavzular), lekin
// har bir forma ochilganda kerak bo'ladi. Shu sabab xotirada saqlanadi —
// aks holda har bir foydalanuvchi uchun uchta ortiqcha so'rov ketardi.

const REF_TTL_MS = 6 * 60 * 60 * 1000; // 6 soat

interface Cached<T> {
  value: T;
  at: number;
}

const refCache: {
  languages?: Cached<TargetLanguage[]>;
  topics?: Cached<TargetTopic[]>;
  countries?: Cached<TargetCountry[]>;
} = {};

function fresh<T>(entry: Cached<T> | undefined): T | null {
  if (!entry) return null;
  return Date.now() - entry.at < REF_TTL_MS ? entry.value : null;
}

export async function getTargetLanguages(): Promise<TargetLanguage[]> {
  const hit = fresh(refCache.languages);
  if (hit) return hit;
  const value = await call<TargetLanguage[]>("getTargetLanguagesList");
  refCache.languages = { value, at: Date.now() };
  return value;
}

export async function getTargetTopics(): Promise<TargetTopic[]> {
  const hit = fresh(refCache.topics);
  if (hit) return hit;
  const value = await call<TargetTopic[]>("getTargetTopicsList");
  refCache.topics = { value, at: Date.now() };
  return value;
}

export async function getTargetCountries(): Promise<TargetCountry[]> {
  const hit = fresh(refCache.countries);
  if (hit) return hit;
  const value = await call<TargetCountry[]>("getTargetCountriesList");
  refCache.countries = { value, at: Date.now() };
  return value;
}

export function searchTargetLocations(
  countryCode: string,
  query: string,
  offset?: string,
  limit = 50
): Promise<{ total_count: number; locations: TargetLocation[]; next_offset?: string }> {
  return call("getTargetLocationsList", {
    country_code: countryCode,
    query,
    offset,
    limit,
  });
}

/**
 * Kanalni username bo'yicha topadi.
 *
 * DIQQAT: Telegram raqamli ID ni faqat AVVAL shu hisob username orqali
 * hal qilgan bo'lsa qabul qiladi. Shuning uchun foydalanuvchi har doim
 * `@username` yozadi va biz shu yerda hal qilamiz — keyin raqamli ID
 * `createAd` da ishlaydi.
 */
export function getTargetChannel(username: string, forExcluding = false): Promise<TargetChannel> {
  return call<TargetChannel>("getTargetChannel", {
    channel_id: username,
    for_excluding: forExcluding,
  });
}

export function getTargetBot(username: string): Promise<TargetBot> {
  return call<TargetBot>("getTargetBot", { bot_id: username });
}

// ═══════════════════════════════════════════════════════════════════════════
//  AUDITORIYALAR
// ═══════════════════════════════════════════════════════════════════════════

export function createAudience(
  title: string,
  phones: string[],
  idempotencyKey: string
): Promise<Audience> {
  return call<Audience>(
    "createAudience",
    { title, add_phones: phones },
    { idempotencyKey }
  );
}

export function editAudience(
  audienceId: number,
  patch: { title?: string; add_phones?: string[]; remove_phones?: string[]; reset_phones?: boolean }
): Promise<Audience> {
  return call<Audience>("editAudience", { audience_id: audienceId, ...patch });
}

export function deleteAudience(audienceId: number): Promise<boolean> {
  return call<boolean>("deleteAudience", { audience_id: audienceId });
}

export function getAudiencesList(): Promise<{ total_count: number; audiences: Audience[] }> {
  return call("getAudiencesList");
}

// ═══════════════════════════════════════════════════════════════════════════
//  PIXEL
// ═══════════════════════════════════════════════════════════════════════════

export function getPixel(): Promise<{ pixel_id: string; code_snippet: string }> {
  return call("getPixel");
}

export function createPixel(idempotencyKey: string): Promise<{
  pixel_id: string;
  code_snippet: string;
}> {
  return call("createPixel", {}, { idempotencyKey });
}

export function getPixelEventsList(): Promise<{ total_count: number; events: PixelEvent[] }> {
  return call("getPixelEventsList");
}

export function createPixelEvent(
  title: string,
  type: string,
  idempotencyKey: string
): Promise<PixelEvent> {
  return call<PixelEvent>("createPixelEvent", { title, type }, { idempotencyKey });
}

export function deletePixelEvent(eventId: string): Promise<boolean> {
  return call<boolean>("deletePixelEvent", { event_id: eventId });
}
