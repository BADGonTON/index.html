/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  REKLAMA MATNI VA PREMIUM EMOJI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Telegram reklama matnini 160 BELGI bilan cheklaydi. Premium (custom)
 * emoji matnda uzun yozuv bo'lib turadi:
 *
 *     ![🎁](tg://emoji?id=5170233102089322756)
 *
 * Bu 40 dan ortiq belgi, lekin EKRANDA bitta emoji ko'rinadi va Telegram
 * ham uni BITTA belgi deb sanaydi. Agar biz xom matnni sanasak, 10 ta
 * emoji qo'ygan foydalanuvchiga "chegaradan oshdingiz" deb, 160 o'rniga
 * atigi 50 belgi yozishga ruxsat berardik.
 *
 * Shuning uchun bu yerda emoji yozuvlari BIR BELGI deb sanaladi.
 *
 * Matn @AdsMarkdownBot orqali tayyorlanadi — u emojini kerakli yozuvga
 * o'giradi. Biz yozuvni O'ZGARTIRMAYMIZ, faqat to'g'ri sanaymiz va
 * Telegramga borichasiga uzatamiz.
 */

/**
 * Premium emoji yozuvining barcha ko'rinishlari.
 *
 * @AdsMarkdownBot va Telegram interfeysi turli shakl ishlatishi mumkin,
 * shuning uchun hammasini tanib olamiz:
 *
 *   ![😀](tg://emoji?id=123)     — markdown, rasm ko'rinishida
 *   [😀](tg://emoji?id=123)      — markdown, havola ko'rinishida
 *   <tg-emoji emoji-id="123">😀</tg-emoji>  — HTML
 */
const EMOJI_PATTERNS: RegExp[] = [
  /!?\[([^\]]*)\]\(tg:\/\/emoji\?id=(\d+)\)/g,
  /<tg-emoji\s+emoji-id=["'](\d+)["']\s*>(.*?)<\/tg-emoji>/g,
];

export interface AdTextInfo {
  /** Telegram sanaydigan uzunlik (emoji = 1 belgi). */
  length: number;
  /** Matndagi premium emojilar soni. */
  emojiCount: number;
  /** Premium emoji ishlatilganmi (eng kam CPM shunga bog'liq). */
  hasPremiumEmoji: boolean;
  /** Emojilar oddiy belgiga aylantirilgan ko'rinish (ko'rsatish uchun). */
  plain: string;
}

/**
 * Matnni tahlil qiladi: haqiqiy uzunlik, emoji soni va sodda ko'rinishi.
 *
 * DIQQAT: bu yerda matn O'ZGARTIRILMAYDI. Telegramga har doim xom matn
 * ketadi — emoji yozuvini biz "tuzatsak", premium emoji yo'qolardi.
 */
export function analyzeAdText(raw: string): AdTextInfo {
  const text = String(raw ?? "");
  let plain = text;
  let emojiCount = 0;

  for (const pattern of EMOJI_PATTERNS) {
    // `replace` har bir moslikni bosib o'tadi — shu yo'l bilan ham
    // sanaymiz, ham sodda ko'rinishni yig'amiz.
    plain = plain.replace(new RegExp(pattern.source, pattern.flags), (...args) => {
      emojiCount++;
      // Guruhlar tartibi naqshga qarab har xil: birinchisida emoji [1],
      // ikkinchisida [2]. Qaysi biri emoji bo'lsa — o'shani olamiz.
      const first = String(args[1] ?? "");
      const second = String(args[2] ?? "");
      const glyph = /^\d+$/.test(first) ? second : first;
      // Emoji yozuvida belgi bo'lmasa (masalan bo'sh kvadrat qavs),
      // o'rniga bitta joy egallovchi qo'yamiz — u ham 1 belgi.
      return glyph || "□";
    });
  }

  return {
    // Telegram uzunlikni UTF-16 kod birliklarida emas, KOD NUQTALARIDA
    // sanaydi: "👍" bitta belgi, ikkita emas. `[...str]` aynan shunday
    // ajratadi, `str.length` esa ikkita deb ko'rsatardi.
    length: [...plain].length,
    emojiCount,
    hasPremiumEmoji: emojiCount > 0,
    plain,
  };
}

/** Reklama matni uchun Telegramning chegarasi. */
export const AD_TEXT_LIMIT = 160;

/** Sarlavha chegarasi (faqat reklama beruvchi ko'radi). */
export const AD_TITLE_LIMIT = 128;

/**
 * Matn chegaraga sig'adimi?
 *
 * Sabab qaytariladi, shunda foydalanuvchiga "160 dan oshdi" emas,
 * "173 belgi — 13 tasini olib tashlang" deyish mumkin.
 */
export function checkAdText(raw: string): { ok: boolean; info: AdTextInfo; over: number } {
  const info = analyzeAdText(raw);
  const over = Math.max(0, info.length - AD_TEXT_LIMIT);
  return { ok: over === 0, info, over };
}

/** Matnda premium emoji bormi — eng kam CPM shunga qarab oshadi. */
export function hasPremiumEmoji(raw: string): boolean {
  return analyzeAdText(raw).emojiCount > 0;
}

/**
 * Matndagi premium emoji ID larini qaytaradi (tartibi saqlanadi).
 *
 * Mini App shu ID lar bo'yicha stikerlarni so'raydi va ko'rinishda
 * haqiqiy, animatsion emojini chizadi.
 */
export function extractEmojiIds(raw: string): string[] {
  const ids: string[] = [];
  const text = String(raw ?? "");

  for (const pattern of EMOJI_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const first = match[1] ?? "";
      const second = match[2] ?? "";
      const id = /^\d+$/.test(first) ? first : second;
      if (/^\d+$/.test(id)) ids.push(id);
    }
  }
  return ids;
}
