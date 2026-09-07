import { InlineKeyboard } from "grammy";
import { MyContext } from "./session";

/**
 * Botning butun interfeysi shu funksiyalar orqali chiqadi:
 *   • tugma bosilganda — xabar JOYIDA tahrirlanadi (tez va chiroyli)
 *   • matn yozilganda — eski bot xabari o'chib, yangisi yuboriladi
 * Shu tufayli chat "chirik" eski menyular bilan to'lib ketmaydi.
 */

const SEND_OPTIONS = {
  parse_mode: "HTML" as const,
  link_preview_options: { is_disabled: true },
};

export async function renderMenu(
  ctx: MyContext,
  text: string,
  keyboard?: InlineKeyboard
): Promise<void> {
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { ...SEND_OPTIONS, reply_markup: keyboard });
      return;
    } catch {
      // Matn bir xil yoki xabar juda eski bo'lsa tahrirlab bo'lmaydi —
      // pastda yangi xabar yuboramiz.
    }
  }

  await deleteLastBotMessage(ctx);
  const sent = await ctx.reply(text, { ...SEND_OPTIONS, reply_markup: keyboard });
  ctx.session.lastBotMessageId = sent.message_id;
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

export async function sendTracked(
  ctx: MyContext,
  text: string,
  keyboard?: InlineKeyboard
): Promise<void> {
  await deleteLastBotMessage(ctx);
  const sent = await ctx.reply(text, { ...SEND_OPTIONS, reply_markup: keyboard });
  ctx.session.lastBotMessageId = sent.message_id;
}
