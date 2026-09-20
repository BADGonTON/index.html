import { Router, raw } from "express";
import {
  isAdsConfigured,
  newIdempotencyKey,
  getCurrentAccount,
  createAd,
  editAd,
  getAdsById,
  increaseAdBudget,
  submitAdForReview,
  deleteAd as deleteTelegramAd,
  getAdStats,
  uploadAdPhoto,
  uploadAdVideo,
  uploadWebsitePhoto,
  getTargetLanguages,
  getTargetTopics,
  getTargetCountries,
  searchTargetLocations,
  getTargetChannel,
  getTargetBot,
  createAudience,
  deleteAudience,
  getAudiencesList,
  getPixel,
  createPixel,
  getPixelEventsList,
  createPixelEvent,
  deletePixelEvent,
  AdPlacement,
  InputAdTarget,
  InputAdTargetUsers,
  CreateAdInput,
  AdSchedule,
} from "../services/telegramAds";
import { userFacingAdsError, adsErrorForLog } from "../services/adsErrors";
import {
  getAdsMarkupPct,
  getAdsMinTopupUzs,
  getTonRateUzs,
  adsQuote,
  tonToUzs,
  uzsToTon,
  minCpmTon,
  minCpmUzs,
} from "../services/pricing";
import {
  checkAdText,
  hasPremiumEmoji,
  extractEmojiIds,
  AD_TEXT_LIMIT,
  AD_TITLE_LIMIT,
} from "../services/adText";
import { resolveEmoji, fetchEmojiFile } from "../services/customEmoji";
import { getBalance, tryDeductBalance, refundBalance } from "../db/repo/users";
import {
  createAdDraft,
  attachTelegramAd,
  syncAdFromTelegram,
  setAdError,
  listUserAds,
  getUserAd,
  deleteAdRow,
  createTopup,
  finishTopup,
  listUserTopups,
  totalSpentUzs,
  countUserAds,
  scheduleRefund,
  hideAd,
  REFUND_COOLDOWN_SEC,
  AdRow,
} from "../db/repo/ads";
import { sendLog } from "../services/logger";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  REKLAMA API  (Mini App'dagi "Reklama" bo'limi)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PUL QOIDASI. Byudjet ikki bosqichda harakatlanadi:
 *
 *   foydalanuvchi balansi (so'm)  →  bizning Telegram Ads hisobimiz (TON)
 *                                 →  aniq bir reklamaning byudjeti
 *
 * Birinchi bosqich ATOMIK (`tryDeductBalance`), ikkinchisi tarmoq orqali va
 * yiqilishi mumkin. Shuning uchun tartib qat'iy:
 *
 *   1. balansdan yechamiz
 *   2. `ad_topups` ga "kutilmoqda" yozuvi
 *   3. Telegramga idempotent kalit bilan boramiz
 *   4. yiqilsa — PULNI QAYTARAMIZ va yozuvni "failed" qilamiz
 *
 * Idempotent kalit tufayli tarmoq uzilib qayta urinilganda Telegram
 * avvalgi javobni qaytaradi — byudjet ikki marta qo'yilmaydi.
 *
 * EGALIK QOIDASI. Telegram tomonda hisob bitta, shuning uchun reklama
 * kimniki ekanini faqat biz bilamiz. Har bir amal `getUserAd(userId, id)`
 * orqali o'tadi — u boshqa odamning reklamasini hech qachon qaytarmaydi.
 */

/** Bitta foydalanuvchi eng ko'p shuncha reklama yarata oladi. */
const MAX_ADS_PER_USER = 50;

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

/** Reklama yozuvini Mini App tushunadigan ko'rinishga o'giradi. */
function serializeAd(row: AdRow) {
  return {
    id: row.id,
    tg_ad_id: row.tg_ad_id,
    title: row.title,
    text: row.text,
    promote_url: row.promote_url,
    placement: row.placement,
    status: row.status,
    // Telegramda `status` va `is_paused` ALOHIDA maydonlar: ko'rikdagi
    // reklama ham to'xtatilgan bo'lishi mumkin. Ikkalasi ham kerak,
    // aks holda ekranda to'xtatish sezilmasdi.
    is_paused: row.is_paused,
    decline_reason: row.decline_reason,
    // Foydalanuvchi HAMMA joyda so'mda ishlaydi — TON faqat Telegram
    // API si talab qilgani uchun ichkarida qoladi va tashqariga chiqmaydi.
    cpm_uzs: tonToUzs(row.cpm_ton),
    budget_uzs: tonToUzs(row.budget_ton),
    spent_uzs: tonToUzs(row.spent_ton),
    views: row.views,
    clicks: row.clicks,
    actions: row.actions,
    ctr: row.views > 0 ? Math.round((row.clicks / row.views) * 10000) / 100 : 0,
    error: row.error_msg,
    created_at: row.created_at,
    synced_at: row.synced_at,
    refund_state: row.refund_state,
    refunded_uzs: tonToUzs(row.refunded_ton),
  };
}

// ───────────────────────── Tekshiruvlar ─────────────────────────

const PLACEMENTS: AdPlacement[] = [
  "channel_post",
  "bot_banner",
  "search_result",
  "video_banner",
];

const BUTTONS = [
  "subscribe", "view", "read", "learn_more", "download", "open",
  "sign_up", "buy", "order", "play", "try", "leave_request",
];

class BadInput extends Error {}

function str(value: unknown, field: string, max: number, required = true): string {
  const text = String(value ?? "").trim();
  if (!text && required) throw new BadInput(`${field} bo'sh qolmasin`);
  if (text.length > max) throw new BadInput(`${field} juda uzun (${max} belgigacha)`);
  return text;
}

function intList(value: unknown, field: string, max: number): number[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new BadInput(`${field} ro'yxat bo'lishi kerak`);
  if (value.length > max) throw new BadInput(`${field}: eng ko'pi ${max} ta`);
  return value.map((v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new BadInput(`${field} da noto'g'ri qiymat`);
    return Math.trunc(n);
  });
}

function strList(value: unknown, field: string, max: number, maxLen = 64): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new BadInput(`${field} ro'yxat bo'lishi kerak`);
  if (value.length > max) throw new BadInput(`${field}: eng ko'pi ${max} ta`);
  return value.map((v) => {
    const s = String(v ?? "").trim();
    if (!s || s.length > maxLen) throw new BadInput(`${field} da noto'g'ri qiymat`);
    return s;
  });
}

/**
 * Targetingni tekshiradi.
 *
 * To'rt xil turi bor va ularning qoidalari BIR-BIRIGA ZID: masalan
 * `channels` turida `channel_ids` berilsa, `topic_ids` va `language_codes`
 * bo'sh bo'lishi SHART. Telegram buni o'zi ham tekshiradi, lekin uning
 * xatosi kalit ko'rinishida keladi — foydalanuvchiga tushunarli jumla
 * berish uchun shu yerda oldindan ushlaymiz.
 */
function parseTarget(raw: unknown): InputAdTarget {
  const t = (raw ?? {}) as Record<string, unknown>;
  const type = String(t.type ?? "");

  if (type === "channels") {
    const channelIds = strList(t.channel_ids, "Kanallar", 100, 120);
    const topicIds = intList(t.topic_ids, "Mavzular", 20);
    const excludeTopicIds = intList(t.exclude_topic_ids, "Istisno mavzular", 20);
    const languageCodes = strList(t.language_codes, "Tillar", 8, 16);

    if (channelIds?.length && (topicIds?.length || languageCodes?.length)) {
      throw new BadInput("Aniq kanallar tanlanganda mavzu va til tanlanmaydi");
    }
    if (topicIds?.length && (languageCodes?.length ?? 0) !== 1) {
      throw new BadInput("Mavzu bo'yicha targetingda aynan bitta til tanlanishi kerak");
    }
    if ((topicIds?.length ?? 0) + (excludeTopicIds?.length ?? 0) > 20) {
      throw new BadInput("Mavzular jami 20 tadan oshmasin");
    }
    if (!channelIds?.length && !topicIds?.length && !languageCodes?.length) {
      throw new BadInput("Kamida bitta til, mavzu yoki kanal tanlang");
    }

    return {
      type: "channels",
      channel_ids: channelIds,
      exclude_channel_ids: strList(t.exclude_channel_ids, "Istisno kanallar", 100, 120),
      topic_ids: topicIds,
      exclude_topic_ids: excludeTopicIds,
      language_codes: languageCodes,
    };
  }

  if (type === "users") {
    const countryCodes = strList(t.country_codes, "Davlatlar", 8, 4);
    if (!countryCodes?.length) throw new BadInput("Kamida bitta davlat tanlang");

    const locationIds = intList(t.location_ids, "Joylar", 20);
    if (locationIds?.length && countryCodes.length !== 1) {
      throw new BadInput("Shahar tanlanganda aynan bitta davlat bo'lishi kerak");
    }

    const topicIds = intList(t.topic_ids, "Qiziqishlar", 20);
    const excludeTopicIds = intList(t.exclude_topic_ids, "Istisno qiziqishlar", 20);
    if ((topicIds?.length ?? 0) + (excludeTopicIds?.length ?? 0) > 20) {
      throw new BadInput("Qiziqishlar jami 20 tadan oshmasin");
    }

    const device = t.device ? String(t.device) : undefined;
    if (device && !["ios", "android", "mobile", "desktop"].includes(device)) {
      throw new BadInput("Qurilma turi noto'g'ri");
    }

    return {
      type: "users",
      country_codes: countryCodes,
      location_ids: locationIds,
      language_codes: strList(t.language_codes, "Tillar", 8, 16),
      topic_ids: topicIds,
      intersect_topics: Boolean(t.intersect_topics) || undefined,
      exclude_topic_ids: excludeTopicIds,
      channel_ids: strList(t.channel_ids, "Kanallar", 100, 120),
      exclude_channel_ids: strList(t.exclude_channel_ids, "Istisno kanallar", 100, 120),
      audience_ids: intList(t.audience_ids, "Auditoriyalar", 4),
      exclude_audience_ids: intList(t.exclude_audience_ids, "Istisno auditoriyalar", 4),
      device: device as InputAdTargetUsers["device"],
      exclude_political_channels: Boolean(t.exclude_political_channels) || undefined,
      political_channels_only: Boolean(t.political_channels_only) || undefined,
    };
  }

  if (type === "bots") {
    const botIds = strList(t.bot_ids, "Botlar", 100, 120);
    if (!botIds?.length) throw new BadInput("Kamida bitta bot tanlang");
    return { type: "bots", bot_ids: botIds };
  }

  if (type === "search") {
    const queries = strList(t.search_queries, "Qidiruv so'zlari", 10, 100);
    if (!queries?.length) throw new BadInput("Kamida bitta qidiruv so'zi yozing");
    return { type: "search", search_queries: queries };
  }

  throw new BadInput("Targeting turi tanlanmagan");
}

/**
 * Jadvalni tekshiradi: 7 ta son, har biri 0..16777215 (24 bit — sutkaning
 * 24 soati). Telegram shu ko'rinishni kutadi.
 */
function parseSchedule(raw: unknown): AdSchedule | undefined {
  if (raw === undefined || raw === null) return undefined;
  const s = raw as Record<string, unknown>;
  const mask = s.week_hours_mask;
  if (!Array.isArray(mask) || mask.length !== 7) {
    throw new BadInput("Jadval 7 kundan iborat bo'lishi kerak");
  }
  const weekHoursMask = mask.map((v) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 16_777_215) {
      throw new BadInput("Jadvalda noto'g'ri qiymat");
    }
    return n;
  });
  // Hammasi nol bo'lsa — jadval yo'q, reklama istalgan vaqtda ko'rinadi.
  if (weekHoursMask.every((n) => n === 0)) return undefined;

  const useViewerTz = Boolean(s.use_viewer_timezone);
  const timezone = s.timezone === undefined ? undefined : Number(s.timezone);
  if (!useViewerTz && timezone === undefined) {
    throw new BadInput("Jadval uchun vaqt mintaqasini tanlang");
  }
  return {
    week_hours_mask: weekHoursMask,
    timezone,
    use_viewer_timezone: useViewerTz || undefined,
  };
}

/** `createAd`/`editAd` uchun umumiy maydonlar. */
function parseAdFields(body: Record<string, unknown>, forEdit: boolean) {
  const title = str(body.title, "Sarlavha", AD_TITLE_LIMIT, !forEdit);

  // Matn UZUNLIGI oddiy `length` bilan sanalmaydi.
  //
  // Premium emoji matnda `![🎁](tg://emoji?id=...)` bo'lib turadi — 40 dan
  // ortiq belgi, lekin Telegram uni BITTA belgi deb sanaydi. Xom uzunlikni
  // tekshirsak, 10 ta emoji qo'ygan odamga 160 o'rniga 50 belgi yozishga
  // ruxsat bergan bo'lardik.
  const text = String(body.text ?? "").trim();
  if (text) {
    const check = checkAdText(text);
    if (!check.ok) {
      throw new BadInput(
        `Matn ${check.info.length} belgi — ${check.over} tasini olib tashlang ` +
          `(chegara ${AD_TEXT_LIMIT}). Premium emoji bitta belgi deb sanaladi.`
      );
    }
  }

  const promoteUrl = str(body.promote_url, "Havola", 256, !forEdit);

  if (promoteUrl && !/^https?:\/\/|^t\.me\//i.test(promoteUrl)) {
    throw new BadInput("Havola https:// bilan boshlanishi kerak");
  }

  const placement = String(body.placement ?? "channel_post") as AdPlacement;
  if (!PLACEMENTS.includes(placement)) throw new BadInput("Joylashuv noto'g'ri");

  // CPM va kunlik limit foydalanuvchidan SO'MDA keladi va shu yerda
  // bir marta TON ga o'giriladi — Telegram API si boshqa birlikni
  // qabul qilmaydi. Mini App TON ni umuman ko'rmaydi.
  const cpmUzs = Number(body.cpm_uzs);
  const cpm = Number.isFinite(cpmUzs) && cpmUzs > 0 ? uzsToTon(cpmUzs) : NaN;
  if (!forEdit && (!Number.isFinite(cpm) || cpm <= 0)) {
    throw new BadInput("CPM narxini kiriting");
  }

  // Eng kam CPM reklama parametrlariga qarab o'sadi: premium emoji,
  // rasm, video va kanal rasmi qimmatroq. Telegram o'z chegarasini
  // API orqali bermaydi, shuning uchun bu BAHO — lekin past qiymat
  // bilan borib rad etilgandan ko'ra shu yerda aytgan ma'qul.
  if (Number.isFinite(cpm) && cpm > 0) {
    const needed = minCpmTon({
      premiumEmoji: hasPremiumEmoji(text),
      photo: Boolean(body.photo_id),
      video: Boolean(body.video_id),
      userpic: Boolean(body.show_userpic),
    });
    if (cpm < needed) {
      const neededUzs = minCpmUzs({
        premiumEmoji: hasPremiumEmoji(text),
        photo: Boolean(body.photo_id),
        video: Boolean(body.video_id),
        userpic: Boolean(body.show_userpic),
      });
      throw new BadInput(
        `Bu reklama uchun CPM kamida ${neededUzs.toLocaleString("ru-RU")} so'm ` +
          `bo'lishi kerak (premium emoji, rasm va video narxni oshiradi).`
      );
    }
  }

  const frequency = body.impression_frequency === undefined
    ? undefined
    : Number(body.impression_frequency);
  if (frequency !== undefined && (!Number.isInteger(frequency) || frequency < 1 || frequency > 4)) {
    throw new BadInput("Ko'rsatish chastotasi 1 dan 4 gacha bo'lsin");
  }

  const button = body.button ? String(body.button) : undefined;
  if (button && !BUTTONS.includes(button)) throw new BadInput("Tugma turi noto'g'ri");

  // Kunlik limit IXTIYORIY va uning eng kam chegarasi YO'Q —
  // Telegram hujjatida shunday: "If 0, the limit is not applied.
  // Defaults to 0." Ya'ni 0 bo'lsa limit qo'llanmaydi.
  const dailyUzs = body.daily_budget_limit_uzs === undefined
    ? undefined
    : Number(body.daily_budget_limit_uzs);
  if (dailyUzs !== undefined && (!Number.isFinite(dailyUzs) || dailyUzs < 0)) {
    throw new BadInput("Kunlik limit noto'g'ri");
  }
  const dailyLimit = dailyUzs === undefined || dailyUzs === 0 ? dailyUzs : uzsToTon(dailyUzs);

  // Sana: hozirgidan keyin va 365 kundan uzoq emas (Telegram talabi).
  const parseDate = (value: unknown, field: string): number | undefined => {
    if (value === undefined || value === null || value === "") return undefined;
    const n = Number(value);
    if (!Number.isFinite(n)) throw new BadInput(`${field} noto'g'ri`);
    const now = nowSec();
    if (n <= now) throw new BadInput(`${field} kelajakda bo'lishi kerak`);
    if (n > now + 365 * 86400) throw new BadInput(`${field} 365 kundan uzoq bo'lmasin`);
    return Math.trunc(n);
  };

  return {
    title,
    text,
    promote_url: promoteUrl,
    placement,
    cpm: Number.isFinite(cpm) && cpm > 0 ? cpm : undefined,
    impression_frequency: frequency,
    website_name: str(body.website_name, "Sayt nomi", 40, false) || undefined,
    website_photo_id: str(body.website_photo_id, "Sayt rasmi", 256, false) || undefined,
    photo_id: str(body.photo_id, "Rasm", 256, false) || undefined,
    video_id: str(body.video_id, "Video", 256, false) || undefined,
    button,
    conversion_event_id: str(body.conversion_event_id, "Konversiya", 256, false) || undefined,
    additional_info: str(body.additional_info, "Qo'shimcha ma'lumot", 64, false) || undefined,
    show_userpic: body.show_userpic === undefined ? undefined : Boolean(body.show_userpic),
    daily_budget_limit: dailyLimit,
    activate_date: parseDate(body.activate_date, "Boshlanish sanasi"),
    deactivate_date: parseDate(body.deactivate_date, "Tugash sanasi"),
    schedule: parseSchedule(body.schedule),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  ROUTER
// ═══════════════════════════════════════════════════════════════════════════

export function createAdsRouter(): Router {
  const api = Router();

  /**
   * Har bir amal uchun umumiy o'ram.
   *
   * Kafolat: foydalanuvchi HECH QACHON xom xato matnini ko'rmaydi.
   * Xom matn adminlar jurnaliga ketadi.
   */
  const guard = (
    handler: (req: Parameters<Parameters<Router["get"]>[1]>[0], res: any) => Promise<void>
  ) => {
    return async (req: any, res: any) => {
      try {
        await handler(req, res);
      } catch (err) {
        if (err instanceof BadInput) {
          res.status(400).json({ error: err.message });
          return;
        }
        const friendly = userFacingAdsError(err);
        console.error("❌ Reklama xatosi:", adsErrorForLog(err));
        res.status(502).json({ error: friendly });
      }
    };
  };

  /** Token yo'q bo'lsa bo'lim umuman ochilmaydi. */
  const requireAds = (_req: any, res: any, next: any) => {
    if (!isAdsConfigured()) {
      res.status(503).json({ error: "Reklama bo'limi hozircha sozlanmagan" });
      return;
    }
    next();
  };

  // ---------------------------------------------------------------------
  //  Boshlang'ich yuklash
  // ---------------------------------------------------------------------
  api.get(
    "/bootstrap",
    guard(async (req, res) => {
      const userId = req.tgUser!.id;

      if (!isAdsConfigured()) {
        res.json({ enabled: false });
        return;
      }

      const [balance, spent, adsCount] = await Promise.all([
        getBalance(userId),
        totalSpentUzs(userId),
        countUserAds(userId),
      ]);

      // Hisob holati foydalanuvchiga KERAK EMAS (bu bizning hisobimiz),
      // lekin u ishlayotganini bilish kerak: ishlamasa bo'limni ochib
      // ovora qilmaymiz.
      let accountOk = true;
      try {
        await getCurrentAccount();
      } catch (err) {
        accountOk = false;
        console.error("❌ Reklama hisobi javob bermadi:", adsErrorForLog(err));
      }

      res.json({
        enabled: true,
        account_ok: accountOk,
        balance_uzs: balance,
        spent_uzs: spent,
        ads_count: adsCount,
        max_ads: MAX_ADS_PER_USER,
        markup_pct: getAdsMarkupPct(),
        min_topup_uzs: getAdsMinTopupUzs(),

        // Eng kam CPM — SO'MDA. Telegram aniq raqamni API orqali
        // BERMAYDI: hujjatda faqat qo'shimcha foizlar bor, shuning uchun
        // bu BAHO. Telegram baribir rad etsa, uning o'z sababi chiqadi.
        cpm: {
          base: minCpmUzs({}),
          premium_emoji: minCpmUzs({ premiumEmoji: true }),
          photo: minCpmUzs({ photo: true }),
          video: minCpmUzs({ video: true }),
          userpic_multiplier: 1.3,
          estimate: true,
        },
        text_limit: AD_TEXT_LIMIT,
        title_limit: AD_TITLE_LIMIT,
        formatter_bot: "https://t.me/AdsMarkdownBot",
        refund_wait_min: Math.round(REFUND_COOLDOWN_SEC / 60),
        placements: PLACEMENTS,
        buttons: BUTTONS,
      });
    })
  );

  // ---------------------------------------------------------------------
  //  Premium emoji
  //
  //  Mini App — oddiy veb sahifa va Telegram unga premium emojini
  //  chizadigan API bermaydi. Lekin BOT stikerni ola oladi, shuning
  //  uchun biz uni olib, ko'rinishda haqiqiy emojini chizamiz.
  // ---------------------------------------------------------------------
  api.post(
    "/emoji",
    guard(async (req, res) => {
      const text = String(req.body?.text ?? "");
      const ids = extractEmojiIds(text);
      if (ids.length === 0) {
        res.json({ items: [] });
        return;
      }
      res.json({ items: await resolveEmoji(ids) });
    })
  );

  /**
   * Emoji faylini uzatadi.
   *
   * Telegramning fayl manzilida BOT TOKENI bor, shuning uchun manzil
   * tashqariga chiqmaydi — faqat baytlar. Kalit ham `file_id` emas,
   * emoji ID si: aks holda bot ko'rgan istalgan faylni so'rash mumkin
   * bo'lardi.
   */
  api.get(
    "/emoji/:id/file",
    guard(async (req, res) => {
      const file = await fetchEmojiFile(String(req.params.id));
      if (!file) {
        res.status(404).end();
        return;
      }
      // Stiker o'zgarmaydi — brauzer uzoq saqlasin.
      res.setHeader("Content-Type", file.contentType);
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
      res.end(Buffer.from(file.body));
    })
  );

  // ---------------------------------------------------------------------
  //  Targeting ma'lumotnomalari
  // ---------------------------------------------------------------------
  api.get(
    "/refs",
    requireAds,
    guard(async (_req, res) => {
      const [countries, languages, topics] = await Promise.all([
        getTargetCountries(),
        getTargetLanguages(),
        getTargetTopics(),
      ]);
      res.json({ countries, languages, topics });
    })
  );

  api.get(
    "/refs/locations",
    requireAds,
    guard(async (req, res) => {
      const country = str(req.query.country, "Davlat", 4);
      const query = str(req.query.q, "Qidiruv", 100);
      const result = await searchTargetLocations(country, query);
      res.json(result);
    })
  );

  /**
   * Kanal yoki botni username bo'yicha topadi.
   *
   * Telegram raqamli ID ni faqat shu hisob AVVAL username orqali hal qilgan
   * bo'lsa qabul qiladi. Shuning uchun foydalanuvchi har doim @username
   * yozadi va biz shu yerda hal qilamiz — keyin `createAd` da ishlaydi.
   */
  api.post(
    "/refs/resolve",
    requireAds,
    guard(async (req, res) => {
      const kind = String(req.body?.kind ?? "channel");
      let username = str(req.body?.username, "Username", 120);
      if (!username.startsWith("@")) username = `@${username}`;

      if (kind === "bot") {
        const bot = await getTargetBot(username);
        res.json({ kind: "bot", id: bot.bot_id, title: bot.title, username: bot.username });
        return;
      }
      const channel = await getTargetChannel(username, Boolean(req.body?.for_excluding));
      res.json({
        kind: "channel",
        id: channel.channel_id,
        title: channel.title,
        username: channel.username,
        photo_url: channel.photo_url,
      });
    })
  );

  // ---------------------------------------------------------------------
  //  Narx hisobi (forma ochiqligida real vaqtda)
  // ---------------------------------------------------------------------
  api.get(
    "/quote",
    requireAds,
    guard(async (req, res) => {
      const uzs = Math.floor(Number(req.query.uzs));
      if (!Number.isFinite(uzs) || uzs <= 0) throw new BadInput("Summani kiriting");
      const quote = adsQuote(uzs);
      res.json({
        total_uzs: quote.total_uzs,
        budget_uzs: quote.budget_uzs,
        fee_uzs: quote.fee_uzs,
      });
    })
  );

  // ---------------------------------------------------------------------
  //  Reklamalar ro'yxati
  // ---------------------------------------------------------------------
  api.get(
    "/",
    requireAds,
    guard(async (req, res) => {
      const userId = req.tgUser!.id;
      const rows = await listUserAds(userId);

      // Ro'yxat KESHDAN chiqadi — Telegram kutilmaydi. Yangi ko'rsatkich
      // kerak bo'lsa foydalanuvchi bitta reklamani ochadi, o'sha yerda
      // sinxronlanadi.
      res.json({ items: rows.map(serializeAd) });
    })
  );

  /** Bitta reklama — Telegramdan YANGI holat bilan. */
  api.get(
    "/:id",
    requireAds,
    guard(async (req, res) => {
      const userId = req.tgUser!.id;
      const row = await getUserAd(userId, Number(req.params.id));
      if (!row) {
        res.status(404).json({ error: "Reklama topilmadi" });
        return;
      }

      if (row.tg_ad_id) {
        try {
          const [fresh] = await getAdsById([row.tg_ad_id]);
          if (fresh) {
            await syncAdFromTelegram(fresh);
            const updated = await getUserAd(userId, row.id);
            res.json({ ad: serializeAd(updated ?? row), target: fresh.target ?? null });
            return;
          }
        } catch (err) {
          // Sinxronlash yiqilsa ham keshdagi holatni ko'rsatamiz —
          // foydalanuvchi bo'sh ekran ko'rmaydi.
          console.error("❌ Reklamani sinxronlab bo'lmadi:", adsErrorForLog(err));
        }
      }
      res.json({ ad: serializeAd(row), target: null });
    })
  );

  // ---------------------------------------------------------------------
  //  Yangi reklama
  // ---------------------------------------------------------------------
  api.post(
    "/",
    requireAds,
    guard(async (req, res) => {
      const userId = req.tgUser!.id;
      const body = (req.body ?? {}) as Record<string, unknown>;

      if ((await countUserAds(userId)) >= MAX_ADS_PER_USER) {
        throw new BadInput(`Reklamalar soni chegarasi: ${MAX_ADS_PER_USER} ta`);
      }

      const fields = parseAdFields(body, false);
      const target = parseTarget(body.target);

      // Qidiruv targetingida matn shart emas, qolganlarida SHART.
      if (target.type !== "search" && !fields.text) {
        throw new BadInput("Reklama matnini yozing");
      }
      // Tashqi havolada sayt nomi majburiy.
      const isExternal = !/^https?:\/\/t\.me\//i.test(fields.promote_url);
      if (isExternal && !fields.website_name) {
        throw new BadInput("Tashqi havola uchun sayt nomini yozing");
      }

      const budgetUzs = Math.floor(Number(body.budget_uzs));
      const minTopup = getAdsMinTopupUzs();
      if (!Number.isFinite(budgetUzs) || budgetUzs < minTopup) {
        throw new BadInput(`Byudjet kamida ${minTopup.toLocaleString("ru-RU")} so'm bo'lsin`);
      }

      const quote = adsQuote(budgetUzs);
      if (quote.budget_ton <= 0) throw new BadInput("Byudjet juda kichik");

      // ── 1. Balansdan yechamiz ──
      const remaining = await tryDeductBalance(userId, quote.total_uzs, "ads", null);
      if (remaining === null) {
        res.status(402).json({
          error: "Balans yetarli emas",
          required_uzs: quote.total_uzs,
          balance_uzs: await getBalance(userId),
        });
        return;
      }

      // ── 2. Bazaga yozamiz (Telegramdan OLDIN) ──
      const draft = await createAdDraft({
        userId,
        title: fields.title,
        text: fields.text,
        promoteUrl: fields.promote_url,
        placement: fields.placement,
      });

      const idempotencyKey = newIdempotencyKey();
      const topup = await createTopup({
        adId: draft.id,
        userId,
        uzs: quote.total_uzs,
        ton: quote.budget_ton,
        feeUzs: quote.fee_uzs,
        idempotencyKey,
      });

      // ── 3. Telegramga ──
      const input: CreateAdInput = {
        title: fields.title,
        text: fields.text || undefined,
        promote_url: fields.promote_url,
        cpm: fields.cpm!,
        placement: fields.placement,
        target,
        photo_id: fields.photo_id,
        video_id: fields.video_id,
        impression_frequency: fields.impression_frequency,
        website_name: fields.website_name,
        website_photo_id: fields.website_photo_id,
        button: fields.button,
        conversion_event_id: fields.conversion_event_id,
        additional_info: fields.additional_info,
        show_userpic: fields.show_userpic,
        initial_budget: quote.budget_ton,
        daily_budget_limit: fields.daily_budget_limit,
        is_paused: body.is_paused === undefined ? undefined : Boolean(body.is_paused),
        activate_date: fields.activate_date,
        deactivate_date: fields.deactivate_date,
        schedule: fields.schedule,
      };

      try {
        const ad = await createAd(input, idempotencyKey);
        await attachTelegramAd(draft.id, ad);
        await finishTopup(topup.id, "done");

        const saved = await getUserAd(userId, draft.id);
        res.json({
          ok: true,
          ad: serializeAd(saved ?? draft),
          balance_uzs: remaining,
          quote,
        });
      } catch (err) {
        // ── 4. Yiqildi: PULNI QAYTARAMIZ ──
        const balance = await refundBalance(userId, quote.total_uzs, draft.id);
        await finishTopup(topup.id, "failed", adsErrorForLog(err));
        await deleteAdRow(draft.id);

        const friendly = userFacingAdsError(err);
        console.error("❌ Reklama yaratilmadi:", adsErrorForLog(err));

        // Hisobda mablag' tugagani — BIZNING ishimiz, foydalanuvchining emas.
        if (/NOT_ENOUGH_BUDGET/i.test(adsErrorForLog(err))) {
          void sendLog(
            `⚠️ <b>REKLAMA HISOBIDA MABLAG' TUGADI</b>\n\n` +
              `Foydalanuvchi <code>${userId}</code> reklama yarata olmadi.\n` +
              `Telegram Ads hisobini to'ldiring.`
          );
        }

        res.status(502).json({ error: friendly, balance_uzs: balance, refunded: true });
      }
    })
  );

  // ---------------------------------------------------------------------
  //  Tahrirlash
  // ---------------------------------------------------------------------
  api.patch(
    "/:id",
    requireAds,
    guard(async (req, res) => {
      const userId = req.tgUser!.id;
      const row = await getUserAd(userId, Number(req.params.id));
      if (!row?.tg_ad_id) {
        res.status(404).json({ error: "Reklama topilmadi" });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const fields = parseAdFields(body, true);
      const patch: Partial<CreateAdInput> = {};

      // Faqat YUBORILGAN maydonlar o'zgaradi — qolganiga tegilmaydi.
      if (fields.title) patch.title = fields.title;
      if (fields.text) patch.text = fields.text;
      if (fields.promote_url) patch.promote_url = fields.promote_url;
      if (fields.cpm !== undefined) patch.cpm = fields.cpm;
      if (fields.photo_id) patch.photo_id = fields.photo_id;
      if (fields.video_id) patch.video_id = fields.video_id;
      if (fields.impression_frequency !== undefined) {
        patch.impression_frequency = fields.impression_frequency;
      }
      if (fields.website_name) patch.website_name = fields.website_name;
      if (fields.website_photo_id) patch.website_photo_id = fields.website_photo_id;
      if (fields.button) patch.button = fields.button;
      if (fields.additional_info) patch.additional_info = fields.additional_info;
      if (fields.show_userpic !== undefined) patch.show_userpic = fields.show_userpic;
      if (fields.daily_budget_limit !== undefined) {
        patch.daily_budget_limit = fields.daily_budget_limit;
      }
      if (fields.activate_date !== undefined) patch.activate_date = fields.activate_date;
      if (fields.deactivate_date !== undefined) patch.deactivate_date = fields.deactivate_date;
      if (body.schedule !== undefined) patch.schedule = fields.schedule ?? false;

      const ad = await editAd(row.tg_ad_id, patch);
      await syncAdFromTelegram(ad);
      const saved = await getUserAd(userId, row.id);
      res.json({ ok: true, ad: serializeAd(saved ?? row) });
    })
  );

  // ---------------------------------------------------------------------
  //  Byudjetni oshirish
  // ---------------------------------------------------------------------
  api.post(
    "/:id/budget",
    requireAds,
    guard(async (req, res) => {
      const userId = req.tgUser!.id;
      const row = await getUserAd(userId, Number(req.params.id));
      if (!row?.tg_ad_id) {
        res.status(404).json({ error: "Reklama topilmadi" });
        return;
      }

      const uzs = Math.floor(Number(req.body?.uzs));
      const minTopup = getAdsMinTopupUzs();
      if (!Number.isFinite(uzs) || uzs < minTopup) {
        throw new BadInput(`Kamida ${minTopup.toLocaleString("ru-RU")} so'm to'ldiring`);
      }

      const quote = adsQuote(uzs);
      if (quote.budget_ton <= 0) throw new BadInput("Summa juda kichik");

      const remaining = await tryDeductBalance(userId, quote.total_uzs, "ads", row.id);
      if (remaining === null) {
        res.status(402).json({
          error: "Balans yetarli emas",
          required_uzs: quote.total_uzs,
          balance_uzs: await getBalance(userId),
        });
        return;
      }

      const idempotencyKey = newIdempotencyKey();
      const topup = await createTopup({
        adId: row.id,
        userId,
        uzs: quote.total_uzs,
        ton: quote.budget_ton,
        feeUzs: quote.fee_uzs,
        idempotencyKey,
      });

      try {
        const ad = await increaseAdBudget(row.tg_ad_id, quote.budget_ton, idempotencyKey);
        await syncAdFromTelegram(ad);
        await finishTopup(topup.id, "done");
        const saved = await getUserAd(userId, row.id);
        res.json({ ok: true, ad: serializeAd(saved ?? row), balance_uzs: remaining, quote });
      } catch (err) {
        const balance = await refundBalance(userId, quote.total_uzs, row.id);
        await finishTopup(topup.id, "failed", adsErrorForLog(err));
        await setAdError(row.id, userFacingAdsError(err));

        console.error("❌ Byudjet oshmadi:", adsErrorForLog(err));
        if (/NOT_ENOUGH_BUDGET/i.test(adsErrorForLog(err))) {
          void sendLog(
            `⚠️ <b>REKLAMA HISOBIDA MABLAG' TUGADI</b>\n\n` +
              `Foydalanuvchi <code>${userId}</code> byudjetni oshira olmadi.\n` +
              `Telegram Ads hisobini to'ldiring.`
          );
        }
        res.status(502).json({ error: userFacingAdsError(err), balance_uzs: balance, refunded: true });
      }
    })
  );

  // ---------------------------------------------------------------------
  //  Pauza / davom / ko'rikka yuborish / o'chirish
  // ---------------------------------------------------------------------
  api.post(
    "/:id/pause",
    requireAds,
    guard(async (req, res) => {
      const userId = req.tgUser!.id;
      const row = await getUserAd(userId, Number(req.params.id));
      if (!row?.tg_ad_id) {
        res.status(404).json({ error: "Reklama topilmadi" });
        return;
      }
      const paused = Boolean(req.body?.paused);
      const ad = await editAd(row.tg_ad_id, { is_paused: paused });

      // Telegram javobida `is_paused` qaytmasligi mumkin (hujjatda u
      // "Optional"). Unda BIZ so'raganimizni yozamiz — aks holda
      // ekranda to'xtatish sezilmay qolardi.
      await syncAdFromTelegram({ ...ad, is_paused: ad.is_paused ?? paused });

      const saved = await getUserAd(userId, row.id);
      res.json({ ok: true, ad: serializeAd(saved ?? row) });
    })
  );

  api.post(
    "/:id/submit",
    requireAds,
    guard(async (req, res) => {
      const userId = req.tgUser!.id;
      const row = await getUserAd(userId, Number(req.params.id));
      if (!row?.tg_ad_id) {
        res.status(404).json({ error: "Reklama topilmadi" });
        return;
      }
      const ad = await submitAdForReview(row.tg_ad_id);
      await syncAdFromTelegram(ad);
      const saved = await getUserAd(userId, row.id);
      res.json({ ok: true, ad: serializeAd(saved ?? row) });
    })
  );

  api.delete(
    "/:id",
    requireAds,
    guard(async (req, res) => {
      const userId = req.tgUser!.id;
      const row = await getUserAd(userId, Number(req.params.id));
      if (!row) {
        res.status(404).json({ error: "Reklama topilmadi" });
        return;
      }

      // Telegramga hali bormagan qoralama — shunchaki o'chiramiz.
      if (!row.tg_ad_id) {
        await deleteAdRow(row.id);
        res.json({ ok: true, refund: false });
        return;
      }

      // BYUDJETDA PUL BOR: avval uni qaytaramiz, keyin o'chiramiz.
      //
      // Teskarisi qilib bo'lmaydi — reklama o'chsa, byudjetdagi pul
      // Telegram tomonda qolib ketardi va uni qaytarib bo'lmasdi.
      //
      // Telegram byudjetni qaytarish uchun reklama kamida 10 daqiqa
      // to'xtagan bo'lishini talab qiladi, shuning uchun ish navbatga
      // qo'yiladi: foydalanuvchi kutib o'tirmaydi.
      const unspent = row.budget_ton;
      if (unspent > 0) {
        await editAd(row.tg_ad_id, { is_paused: true }).catch(() => {});
        await scheduleRefund(row.id, true);

        // Foydalanuvchi ro'yxatidan DARHOL ketadi.
        //
        // Yozuvning o'zi qolaveradi — pulni qaytarish uchun kerak —
        // lekin ekranda ko'rinmaydi. Aks holda "o'chirdim, lekin
        // o'chmadi" degan holat chiqardi.
        await hideAd(row.id);

        res.json({
          ok: true,
          refund: true,
          refund_uzs: tonToUzs(unspent),
          wait_min: Math.round(REFUND_COOLDOWN_SEC / 60),
        });
        return;
      }

      // Byudjet bo'sh — qaytaradigan narsa yo'q, darhol o'chiramiz.
      await deleteTelegramAd(row.tg_ad_id);
      await deleteAdRow(row.id);
      res.json({ ok: true, refund: false });
    })
  );

  // ---------------------------------------------------------------------
  //  Statistika
  // ---------------------------------------------------------------------
  api.get(
    "/:id/stats",
    requireAds,
    guard(async (req, res) => {
      const userId = req.tgUser!.id;
      const row = await getUserAd(userId, Number(req.params.id));
      if (!row?.tg_ad_id) {
        res.status(404).json({ error: "Reklama topilmadi" });
        return;
      }

      const interval = Number(req.query.interval) === 300 ? 300 : 86400;
      const to = nowSec();
      const days = Math.min(90, Math.max(1, Math.floor(Number(req.query.days) || 7)));
      const from = to - days * 86400;

      const items = await getAdStats(row.tg_ad_id, from, to, interval as 300 | 86400);
      res.json({
        items: items.map((s) => ({
          from_time: s.from_time,
          to_time: s.to_time,
          views: s.views,
          clicks: s.clicks,
          actions: s.actions,
          spent_uzs: tonToUzs(s.spent_budget),
        })),
      });
    })
  );

  // ---------------------------------------------------------------------
  //  Tranzaksiyalar (Profil bo'limi uchun)
  // ---------------------------------------------------------------------
  api.get(
    "/me/history",
    requireAds,
    guard(async (req, res) => {
      const userId = req.tgUser!.id;
      const rows = await listUserTopups(userId);
      res.json({
        items: rows.map((t) => ({
          id: t.id,
          ad_id: t.ad_id,
          uzs: t.uzs,
          fee_uzs: t.fee_uzs,
          status: t.status,
          created_at: t.created_at,
        })),
      });
    })
  );

  // ---------------------------------------------------------------------
  //  Auditoriyalar
  // ---------------------------------------------------------------------
  api.get(
    "/audiences/list",
    requireAds,
    guard(async (_req, res) => {
      res.json(await getAudiencesList());
    })
  );

  api.post(
    "/audiences/list",
    requireAds,
    guard(async (req, res) => {
      const title = str(req.body?.title, "Nom", 64);
      const phones = strList(req.body?.phones, "Telefonlar", 10_000, 80) ?? [];
      const audience = await createAudience(title, phones, newIdempotencyKey());
      res.json({ ok: true, audience });
    })
  );

  api.delete(
    "/audiences/:audienceId",
    requireAds,
    guard(async (req, res) => {
      await deleteAudience(Number(req.params.audienceId));
      res.json({ ok: true });
    })
  );

  // ---------------------------------------------------------------------
  //  Pixel (tashqi saytdagi konversiyalarni kuzatish)
  // ---------------------------------------------------------------------
  api.get(
    "/pixel/info",
    requireAds,
    guard(async (_req, res) => {
      const [pixel, events] = await Promise.all([
        getPixel().catch(() => null),
        getPixelEventsList().catch(() => ({ total_count: 0, events: [] })),
      ]);
      res.json({ pixel, events: events.events });
    })
  );

  api.post(
    "/pixel/info",
    requireAds,
    guard(async (_req, res) => {
      res.json({ ok: true, pixel: await createPixel(newIdempotencyKey()) });
    })
  );

  api.post(
    "/pixel/events",
    requireAds,
    guard(async (req, res) => {
      const title = str(req.body?.title, "Nom", 64);
      const type = str(req.body?.type, "Tur", 40);
      res.json({ ok: true, event: await createPixelEvent(title, type, newIdempotencyKey()) });
    })
  );

  api.delete(
    "/pixel/events/:eventId",
    requireAds,
    guard(async (req, res) => {
      await deletePixelEvent(String(req.params.eventId));
      res.json({ ok: true });
    })
  );

  // ---------------------------------------------------------------------
  //  Fayl yuklash
  //
  //  Fayl XOM BAYT bo'lib keladi (`express.raw`), base64 emas: base64
  //  hajmni üchdan bir baravar oshiradi va 20 MB lik video 27 MB lik
  //  JSON ga aylanardi.
  // ---------------------------------------------------------------------
  const rawBody = raw({ type: () => true, limit: "25mb" });

  const uploadRoute = (
    path: string,
    maxBytes: number,
    allowed: RegExp,
    send: (buf: Buffer, name: string, type: string) => Promise<unknown>
  ) => {
    api.post(
      path,
      requireAds,
      rawBody,
      guard(async (req, res) => {
        const buf = req.body as unknown as Buffer;
        const type = String(req.headers["content-type"] ?? "").split(";")[0].trim();

        if (!Buffer.isBuffer(buf) || buf.length === 0) {
          throw new BadInput("Fayl bo'sh");
        }
        if (buf.length > maxBytes) {
          throw new BadInput(`Fayl juda katta (${Math.round(maxBytes / 1024 / 1024)} MB gacha)`);
        }
        if (!allowed.test(type)) throw new BadInput("Fayl turi mos emas");

        const ext = type.split("/")[1] || "bin";
        res.json({ ok: true, result: await send(buf, `upload.${ext}`, type) });
      })
    );
  };

  uploadRoute("/upload/photo", 5 * 1024 * 1024, /^image\/(jpeg|png)$/, uploadAdPhoto);
  uploadRoute("/upload/video", 20 * 1024 * 1024, /^video\/mp4$/, uploadAdVideo);
  uploadRoute("/upload/website-photo", 1024 * 1024, /^image\/(jpeg|png)$/, uploadWebsitePhoto);

  return api;
}

/** Bo'lim yoqilganmi — Mini App sahifasi shunga qarab tugma ko'rsatadi. */
export function adsEnabled(): boolean {
  return isAdsConfigured();
}
