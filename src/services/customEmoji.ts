import type { Api } from "grammy";
import { config } from "../config";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  PREMIUM EMOJINI MINI APP'DA CHIZISH
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Mini App — oddiy veb sahifa. Telegram unga premium emojini chizadigan
 * API bermaydi, shuning uchun "o'zi chiqib qoladi" degan narsa yo'q.
 *
 * Lekin BOT chiza oladi. Har bir premium emoji aslida stiker:
 *
 *   custom_emoji_id → getCustomEmojiStickers → Sticker → getFile → fayl
 *
 * Fayl uch xil bo'ladi:
 *
 *   • WEBM (is_video)      — <video> da o'ynaydi          ✅
 *   • WEBP (oddiy)         — <img> da chiqadi             ✅
 *   • TGS  (is_animated)   — gzip qilingan Lottie JSON    ⚠️
 *
 * TGS ni chizish uchun brauzerga lottie kutubxonasi kerak — Mini App
 * uchun og'ir. Shuning uchun u oddiy emojiga qaytadi. Amalda premium
 * emojilarning aksariyati WEBM.
 *
 * XAVFSIZLIK. Telegramning fayl manzilida BOT TOKENI bor:
 *
 *   https://api.telegram.org/file/bot<TOKEN>/stickers/xxx.webm
 *
 * Bu manzil hech qachon tashqariga chiqmaydi — fayl bizning server
 * orqali uzatiladi. Manzilning kaliti ham `file_id` emas, EMOJI ID si:
 * `file_id` ni tashqaridan berib bo'lganda, bot ko'rgan istalgan faylni
 * so'rash mumkin bo'lardi.
 */

export type EmojiKind = "video" | "static" | "lottie";

export interface ResolvedEmoji {
  id: string;
  kind: EmojiKind;
  /** Oddiy emoji — chizib bo'lmasa shu ko'rinadi. */
  glyph: string;
  /** Bizning proksi manzilimiz (bot tokeni yo'q). */
  url: string | null;
}

interface CacheEntry {
  value: ResolvedEmoji;
  filePath: string | null;
  at: number;
}

/**
 * Stikerlar o'zgarmaydi, shuning uchun uzoq saqlanadi. `file_path` esa
 * Telegramda taxminan bir soat yashaydi — uni alohida yangilaymiz.
 */
const META_TTL_MS = 24 * 60 * 60 * 1000;
const PATH_TTL_MS = 30 * 60 * 1000;

const cache = new Map<string, CacheEntry>();

/** Bir vaqtda shuncha emojidan ko'pini so'ramaymiz (Telegram chegarasi 200). */
const MAX_BATCH = 100;

let apiRef: Api | null = null;

export function bindCustomEmoji(api: Api): void {
  apiRef = api;
}

function kindOf(sticker: { is_video?: boolean; is_animated?: boolean }): EmojiKind {
  if (sticker.is_video) return "video";
  if (sticker.is_animated) return "lottie";
  return "static";
}

/**
 * Emoji ID larini stiker ma'lumotiga aylantiradi.
 *
 * Topilmagan yoki xato bergan emoji ro'yxatdan TUSHIB QOLADI — Mini App
 * unday emojini oddiy holda ko'rsatadi. Ya'ni bu funksiya hech qachon
 * butun ko'rinishni yiqitmaydi.
 */
export async function resolveEmoji(ids: string[]): Promise<ResolvedEmoji[]> {
  if (!apiRef || ids.length === 0) return [];

  const unique = [...new Set(ids.filter((id) => /^\d+$/.test(id)))].slice(0, MAX_BATCH);
  const now = Date.now();
  const result: ResolvedEmoji[] = [];
  const missing: string[] = [];

  for (const id of unique) {
    const hit = cache.get(id);
    if (hit && now - hit.at < META_TTL_MS) result.push(hit.value);
    else missing.push(id);
  }

  if (missing.length > 0) {
    try {
      const stickers = await apiRef.getCustomEmojiStickers(missing);
      for (const sticker of stickers) {
        const id = sticker.custom_emoji_id;
        if (!id) continue;

        const value: ResolvedEmoji = {
          id,
          kind: kindOf(sticker),
          glyph: sticker.emoji ?? "",
          // Lottie ni brauzerda chizolmaymiz — manzil ham bermaymiz,
          // aks holda Mini App bo'sh <video> qo'yib qo'yardi.
          url: kindOf(sticker) === "lottie" ? null : emojiFileUrl(id),
        };

        cache.set(id, { value, filePath: null, at: now });
        result.push(value);
      }
    } catch (err) {
      // Emoji chizilmasa ham reklama ko'rinishi ishlayveradi.
      console.error("Premium emojini olib bo'lmadi:", (err as Error).message);
    }
  }

  return result;
}

function emojiFileUrl(id: string): string {
  return `/api/ads/emoji/${id}/file`;
}

/**
 * Emoji faylini Telegramdan o'qiydi.
 *
 * Faqat AVVAL `resolveEmoji` orqali tanilgan emojilar uchun ishlaydi —
 * shuning uchun bu yerdan bot ko'rgan boshqa fayllarni so'rab bo'lmaydi.
 */
export async function fetchEmojiFile(
  id: string
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  if (!apiRef || !/^\d+$/.test(id)) return null;

  const entry = cache.get(id);
  if (!entry || entry.value.kind === "lottie") {
    // Hali tanilmagan bo'lsa — tanib olamiz.
    if (!entry) {
      const [resolved] = await resolveEmoji([id]);
      if (!resolved || resolved.kind === "lottie") return null;
    } else {
      return null;
    }
  }

  const current = cache.get(id);
  if (!current) return null;

  // `file_path` bir soatcha yashaydi — eskirgan bo'lsa yangilaymiz.
  if (!current.filePath || Date.now() - current.at > PATH_TTL_MS) {
    try {
      const [sticker] = await apiRef.getCustomEmojiStickers([id]);
      if (!sticker) return null;
      const file = await apiRef.getFile(sticker.file_id);
      current.filePath = file.file_path ?? null;
      current.at = Date.now();
    } catch (err) {
      console.error("Emoji faylini olib bo'lmadi:", (err as Error).message);
      return null;
    }
  }

  if (!current.filePath) return null;

  // DIQQAT: shu manzilda BOT TOKENI bor. U hech qachon javobga
  // qo'shilmaydi — faqat baytlar uzatiladi.
  const url = `https://api.telegram.org/file/bot${config.botToken}/${current.filePath}`;
  const res = await fetch(url);
  if (!res.ok) return null;

  return {
    body: await res.arrayBuffer(),
    contentType: current.value.kind === "video" ? "video/webm" : "image/webp",
  };
}
