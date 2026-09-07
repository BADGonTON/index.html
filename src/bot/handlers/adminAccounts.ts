import { Bot } from "grammy";
import { MyContext } from "../session";
import { sendTracked, renderMenu } from "../ui";
import { isAdmin } from "../../config";
import { STEP } from "../steps";
import {
  fmt,
  ADMIN_TG_ADD_PHONE,
  ADMIN_TG_ADD_PRICE,
  ADMIN_TG_ADD_TWOFA,
  ADMIN_TG_ADD_SENDING_CODE,
  ADMIN_TG_ADD_ENTER_CODE,
  ADMIN_TG_ADD_SUCCESS,
} from "../texts";
import { adminBackKb } from "../keyboards";
import { addTgAccount, countTgAccountsByStatus } from "../../db/repo/tgAccounts";
import { startPhoneLogin, finishPhoneLogin, clearPendingLogin } from "../../services/telegramAccount";

export function registerAdminAccountsHandlers(bot: Bot<MyContext>): void {
  bot.callbackQuery("admin_tg_add", async (ctx) => {
    if (!isAdmin(ctx.from!.id)) return;
    ctx.session.data = {};
    await sendTracked(ctx, ADMIN_TG_ADD_PHONE, adminBackKb());
    ctx.session.step = STEP.ADMIN_TG_ADD_PHONE;
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("admin_tg_stats", async (ctx) => {
    if (!isAdmin(ctx.from!.id)) return;
    const stats = await countTgAccountsByStatus();
    await renderMenu(
      ctx,
      `📊 <b>Akkauntlar statistikasi</b>\n\n` +
        `🟢 Mavjud: <b>${stats.available}</b>\n` +
        `🟡 Band (to'lov kutilmoqda/jarayonda): <b>${stats.pending}</b>\n` +
        `🔴 Sotilgan: <b>${stats.sold}</b>`,
      adminBackKb()
    );
    await ctx.answerCallbackQuery();
  });
}

export async function handleAdminTgPhoneText(ctx: MyContext): Promise<void> {
  const phone = (ctx.message?.text ?? "").trim();
  if (!/^\+?\d{9,15}$/.test(phone)) {
    await ctx.reply("❌ Noto'g'ri format. Masalan <code>+998901234567</code>", { parse_mode: "HTML" });
    return;
  }
  ctx.session.data = { phone };
  await ctx.reply(ADMIN_TG_ADD_PRICE, { parse_mode: "HTML" });
  ctx.session.step = STEP.ADMIN_TG_ADD_PRICE;
}

export async function handleAdminTgPriceText(ctx: MyContext): Promise<void> {
  const text = (ctx.message?.text ?? "").trim();
  if (!/^\d+$/.test(text)) {
    await ctx.reply("❌ Faqat raqam kiriting. Masalan <code>150000</code>", { parse_mode: "HTML" });
    return;
  }
  ctx.session.data = { ...ctx.session.data, price: parseInt(text, 10) };
  await ctx.reply(ADMIN_TG_ADD_TWOFA, { parse_mode: "HTML" });
  ctx.session.step = STEP.ADMIN_TG_ADD_TWOFA;
}

export async function handleAdminTgTwoFaText(ctx: MyContext): Promise<void> {
  const raw = (ctx.message?.text ?? "").trim();
  const twoFa = raw === "-" ? null : raw;
  const { phone, price } = ctx.session.data as { phone: string; price: number };

  // MUHIM: twoFa ni sessiyaga ham yozib qo'yamiz, chunki handleAdminTgCodeText
  // aynan shu yerdan o'qib, bazaga yozadi (oldin bu qator yo'q edi — shu sabab
  // 2FA doim "yo'q" bo'lib saqlanar edi, garchi admin uni kiritgan bo'lsa ham).
  ctx.session.data = { ...ctx.session.data, twoFa };

  await ctx.reply(ADMIN_TG_ADD_SENDING_CODE, { parse_mode: "HTML" });
  try {
    await startPhoneLogin(ctx.from!.id, phone, twoFa, price);
    await ctx.reply(ADMIN_TG_ADD_ENTER_CODE, { parse_mode: "HTML" });
    ctx.session.step = STEP.ADMIN_TG_ADD_CODE;
  } catch (err) {
    await ctx.reply(`❌ Xatolik yuz berdi: <code>${(err as Error).message}</code>`, { parse_mode: "HTML" });
    ctx.session.step = undefined;
    ctx.session.data = {};
  }
}

export async function handleAdminTgCodeText(ctx: MyContext): Promise<void> {
  const raw = ctx.message?.text ?? "";
  const codeDigits = raw.replace(/\D/g, "");
  if (!codeDigits) {
    await ctx.reply("⚠️ Koda hech qanday raqam topilmadi. Qayta kiriting (masalan k19261):");
    return;
  }

  const { phone, price, twoFa } = ctx.session.data as { phone: string; price: number; twoFa: string | null };

  try {
    const { sessionString } = await finishPhoneLogin(ctx.from!.id, codeDigits);
    await addTgAccount({ phone, session_string: sessionString, two_fa: twoFa, price });
    await ctx.reply(fmt(ADMIN_TG_ADD_SUCCESS, { phone, price }), {
      parse_mode: "HTML",
      reply_markup: adminBackKb(),
    });
  } catch (err) {
    await ctx.reply(`❌ Kirishda xatolik: <code>${(err as Error).message}</code>`, { parse_mode: "HTML" });
    clearPendingLogin(ctx.from!.id);
  }
  ctx.session.step = undefined;
  ctx.session.data = {};
}
