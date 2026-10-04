import type { Message, MessageEntity } from "grammy/types";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  FOYDALANUVCHI YUBORGAN PREMIUM EMOJINI SAQLAB QOLISH
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Telegram premium emojini xabar MATNIDA yubormaydi — matnda faqat oddiy
 * zaxira belgisi (🎁) turadi, haqiqiy emoji esa `entities` ichida
 * `custom_emoji` bo'lib keladi:
 *
 *   text:     "🎁 Sinov konkursi"
 *   entities: [{ type: "custom_emoji", offset: 0, length: 2,
 *                custom_emoji_id: "5368324170671202286" }]
 *
 * Ya'ni faqat `message.text` ni o'qisak, admin tanlagan AYNIQSA O'SHA
 * emoji yo'qoladi va o'rniga oddiy belgi qoladi. Shu funksiya ikkisini
 * birlashtirib, Telegram qaytarib yuborish uchun tushunadigan HTML yasaydi:
 *
 *   <tg-emoji emoji-id="5368324170671202286">🎁</tg-emoji> Sinov konkursi
 *
 * Natija: admin xabarga qanday emoji qo'ygan bo'lsa, konkurs e'lonida
 * ham AYNAN o'shasi chiqadi — "nusxa ko'chirgandek".
 *
 * Offset'lar UTF-16 birliklarida beriladi va JS satrlari ham UTF-16,
 * shuning uchun `slice()` to'g'ridan-to'g'ri ishlaydi.
 */

function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string
  );
}

/**
 * Xabar matnini HTML ga aylantiradi: `custom_emoji` teg bo'ladi, qolgan
 * matn esa xavfsiz holatga keltiriladi.
 *
 * Boshqa formatlar (qalin, havola) ATAYLAB olinmaydi: konkurs nomi va
 * sovrini bir necha joyda, turli kontekstda chiqadi va u yerda
 * yarim-formatlangan matn chalkashlik qiladi. Bizga keragi — emoji.
 */
export function htmlWithCustomEmoji(
  text: string | undefined,
  entities: MessageEntity[] | undefined
): string {
  if (!text) return "";

  const emoji = (entities ?? [])
    .filter((e): e is MessageEntity & { custom_emoji_id: string } =>
      e.type === "custom_emoji" && typeof (e as { custom_emoji_id?: string }).custom_emoji_id === "string"
    )
    // Telegram tartibni kafolatlamaydi, biz esa ketma-ket kesib boramiz.
    .sort((a, b) => a.offset - b.offset);

  let out = "";
  let at = 0;

  for (const e of emoji) {
    // Bir-birining ustiga tushgan yoki chegaradan chiqqan entity'ni
    // o'tkazib yuboramiz — aks holda matn buzilib ketardi.
    if (e.offset < at || e.offset + e.length > text.length) continue;

    out += escapeHtml(text.slice(at, e.offset));
    const glyph = text.slice(e.offset, e.offset + e.length);
    out += `<tg-emoji emoji-id="${e.custom_emoji_id}">${escapeHtml(glyph)}</tg-emoji>`;
    at = e.offset + e.length;
  }

  out += escapeHtml(text.slice(at));
  return out;
}

/** `htmlWithCustomEmoji` ning xabar uchun qisqa shakli. */
export function messageHtml(message: Message | undefined): string {
  return htmlWithCustomEmoji(message?.text, message?.entities);
}

/**
 * Xabarni QATORLARGA bo'lib, har birini alohida HTML ga aylantiradi.
 *
 * Nega avval bo'linadi, keyin aylantiriladi (teskarisi emas): tayyor
 * HTML ni `\n` bo'yicha bo'lish `<tg-emoji>` tegini O'RTASIDAN kesib
 * yuborishi mumkin — bir tomonda ochilish tegi, ikkinchisida yopilish
 * qoladi va ikkala qator ham buziladi. Qatorlar xom matndan ajratilsa,
 * teg hech qachon qator chegarasini kesib o'tmaydi.
 */
export function linesWithCustomEmoji(
  text: string | undefined,
  entities: MessageEntity[] | undefined
): string[] {
  if (!text) return [];

  const out: string[] = [];
  let at = 0;

  for (const line of text.split("\n")) {
    const start = at;
    const end = at + line.length;

    // Faqat SHU qator ichiga to'liq sig'adigan entity'lar, offset'i
    // qator boshiga nisbatan qayta hisoblanadi.
    const inLine = (entities ?? [])
      .filter((e) => e.offset >= start && e.offset + e.length <= end)
      .map((e) => ({ ...e, offset: e.offset - start }));

    out.push(htmlWithCustomEmoji(line, inLine));
    at = end + 1; // "\n" ning o'zi
  }

  return out;
}

/** `linesWithCustomEmoji` ning xabar uchun qisqa shakli. */
export function messageLinesHtml(message: Message | undefined): string[] {
  return linesWithCustomEmoji(message?.text, message?.entities);
}
