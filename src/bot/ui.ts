import { InlineKeyboard } from "grammy";
import { MyContext } from "./session";
import { premiumize } from "./emoji";
import { config } from "../config";

/**
 * Botning butun interfeysi shu funksiyalar orqali chiqadi.
 *
 * IKKI QOIDA:
 *
 * 1) EMOJI. Matn yuborilishidan oldin `premiumize()` dan o'tadi, ya'ni
 *    har bir oddiy emoji premium emojiga aylanadi. Matn yozganda bu haqda
 *    o'ylash shart emas.
 *
 * 2) TAHRIRLASH. Chatda eski menyular to'planib qolmasligi kerak, lekin
 *    "o'chirib, yangisini yuborish" — bu IKKI so'rov va sezilarli kechikish.
 *    Shuning uchun har doim avval TAHRIRLASH sinaladi:
 *
 *      • tugma bosilganda  → o'sha xabar joyida tahrirlanadi (1 so'rov)
 *      • matn yozilganda   → oxirgi bot xabari tahrirlanadi (1 so'rov)
 *      • faqat iloji bo'lmasa → yangi xabar yuboriladi
 *
 *    Foydalanuvchi tomondan bu bir zumda bo'ladi va chat toza qoladi.
 */

const SEND_OPTIONS = {
  parse_mode: "HTML" as const,
  link_preview_options: { is_disabled: true },
};

function prepare(text: string): string {
  return config.premiumEmoji ? premiumize(text) : text;
}

/**
 * Menyuni ko'rsatadi — imkon boricha MAVJUD xabarni tahrirlab.
 *
 * Qaytadi: xabar tahrirlandimi (true) yoki yangisi yuborildimi (false).
 */
export async function renderMenu(
  ctx: MyContext,
  text: string,
  keyboard?: InlineKeyboard
): Promise<void> {
  const body = prepare(text);

  // 1) Tugma bosilgan bo'lsa — aynan o'sha xabarni tahrirlaymiz.
  if (ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(body, { ...SEND_OPTIONS, reply_markup: keyboard });
      ctx.session.lastBotMessageId = ctx.callbackQuery.message.message_id;
      return;
    } catch (err) {
      // "message is not modified" — matn ham, tugmalar ham o'zgarmagan.
      // Bu xato emas: foydalanuvchi shunchaki o'sha tugmani qayta bosgan.
      if (isNotModified(err)) return;
      // Boshqa holatlarda (xabar juda eski, o'chirilgan) pastda yangisini
      // yuboramiz.
    }
  }

  // 2) Matn yozilgan bo'lsa — oxirgi bot xabarini tahrirlaymiz.
  await editTrackedOrSend(ctx, body, keyboard);
}

/**
 * Bosqichdagi savolni ko'rsatadi (foydalanuvchi matn yozgandan keyin).
 *
 * Oxirgi bot xabarini TAHRIRLAYDI: "summa kiriting" → "username kiriting"
 * bir joyda almashib turadi va chat toza qoladi.
 */
export async function sendTracked(
  ctx: MyContext,
  text: string,
  keyboard?: InlineKeyboard
): Promise<void> {
  await editTrackedOrSend(ctx, prepare(text), keyboard);
}

/**
 * HODISA haqidagi xabarni chatning OXIRIGA yuboradi — hech qachon
 * tahrirlamaydi.
 *
 * Nega alohida funksiya kerak: "to'lov tasdiqlandi", "buyurtma bajarildi"
 * kabi xabarlar foydalanuvchi menyu bo'ylab yurgani uchun emas, TASHQI
 * voqea sodir bo'lgani uchun chiqadi. Ular orasida bot boshqa narsa
 * (masalan chek namunasi rasmi) yuborgan bo'lishi mumkin.
 *
 * Aynan shu holatda xato bor edi: chek tashlangach javob eski "karta
 * ma'lumoti" xabarini tahrirlab yozilardi. U esa rasmdan YUQORIDA turardi —
 * ekranning pastida hech narsa o'zgarmasdi va bot "javob bermagandek"
 * ko'rinardi. Endi bunday xabar har doim pastda, yangi xabar bo'lib chiqadi.
 */
export async function sendFresh(
  ctx: MyContext,
  text: string,
  keyboard?: InlineKeyboard
): Promise<void> {
  const sent = await ctx.reply(prepare(text), { ...SEND_OPTIONS, reply_markup: keyboard });
  ctx.session.lastBotMessageId = sent.message_id;
}

/**
 * Oxirgi bot xabarini tahrirlaydi; bo'lmasa yangisini yuboradi.
 *
 * Tahrirlash MUVAFFAQIYATSIZ bo'lishi mumkin: xabar 48 soatdan eski,
 * o'chirilgan, yoki rasmli xabar (matnga aylantirib bo'lmaydi). Shunda
 * eskisini o'chirib, yangisini yuboramiz.
 */
async function editTrackedOrSend(
  ctx: MyContext,
  body: string,
  keyboard?: InlineKeyboard
): Promise<void> {
  const lastId = ctx.session.lastBotMessageId;

  if (lastId && ctx.chat) {
    try {
      await ctx.api.editMessageText(ctx.chat.id, lastId, body, {
        ...SEND_OPTIONS,
        reply_markup: keyboard,
      });
      return;
    } catch (err) {
      if (isNotModified(err)) return;
      // Tahrirlab bo'lmadi — eskisini olib tashlaymiz.
      await deleteLastBotMessage(ctx);
    }
  }

  const sent = await ctx.reply(body, { ...SEND_OPTIONS, reply_markup: keyboard });
  ctx.session.lastBotMessageId = sent.message_id;
}

/** Telegram "hech narsa o'zgarmadi" desa — bu xato emas. */
function isNotModified(err: unknown): boolean {
  return /message is not modified/i.test((err as Error)?.message ?? "");
}

export async function deleteLastBotMessage(ctx: MyContext): Promise<void> {
  const id = ctx.session.lastBotMessageId;
  ctx.session.lastBotMessageId = undefined;
  if (!id || !ctx.chat) return;
  try {
    await ctx.api.deleteMessage(ctx.chat.id, id);
  } catch {
    // Allaqachon o'chirilgan yoki 48 soatdan eski — e'tiborsiz.
  }
}

/**
 * Foydalanuvchi yozgan xabarni o'chiradi.
 *
 * Summa, username, kod kabi qiymatlar kiritilgandan keyin chaqiriladi:
 * chatda faqat BITTA — botning tahrirlanadigan xabari qoladi.
 */
export async function deleteUserMessage(ctx: MyContext): Promise<void> {
  if (!ctx.chat || !ctx.message) return;
  try {
    await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
  } catch {
    // Botda o'chirish huquqi bo'lmasligi mumkin — muhim emas.
  }
}
