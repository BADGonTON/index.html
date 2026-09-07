import { Bot } from "grammy";
import { MyContext } from "../session";
import { renderMenu, sendTracked } from "../ui";
import { config } from "../../config";
import { STEP } from "../steps";
import {
  fmt,
  PREMIUM_MENU,
  PREMIUM_USERNAME_FORMAT_ERROR,
  PREMIUM_INVALID_MONTHS,
  PREMIUM_INSUFFICIENT_BALANCE,
  PREMIUM_CONFIRMING_ORDER,
  PREMIUM_QUEUED,
  ERROR_INSUFFICIENT_TON,
  ERROR_UNKNOWN,
} from "../texts";
import { backKb, successKb } from "../keyboards";
import { getBalance, tryDeductBalance, refundBalance } from "../../db/repo/users";
import { addPendingTx, getQueueSize } from "../../db/repo/transactions";
import { getPremiumPrices, buyPremium } from "../../services/marketapp";
import { getWallet } from "../../services/wallet";
import { sendLog } from "../../services/logger";
import { now } from "../../util/time";
import { getStarPrice } from "../../services/starPrice";

/** Premium narxi Stars ekvivalentida (Fragment tarifiga mos). */
const MONTH_STAR_COST: Record<number, number> = { 3: 750, 6: 1000, 12: 1750 };
const ALLOWED_MONTHS = [3, 6, 12];
const USERNAME_RE = /^@?([A-Za-z0-9_]{5,32})$/;

export function registerPremiumHandlers(bot: Bot<MyContext>): void {
  bot.callbackQuery("premium", async (ctx) => {
    await renderMenu(ctx, PREMIUM_MENU, backKb("back_to_main"));
    ctx.session.step = STEP.PREMIUM_USERNAME;
    ctx.session.data = {};
    await ctx.answerCallbackQuery();
  });
}

export async function handlePremiumUsernameText(ctx: MyContext): Promise<void> {
  const match = (ctx.message?.text ?? "").trim().match(USERNAME_RE);
  if (!match) {
    await sendTracked(ctx, PREMIUM_USERNAME_FORMAT_ERROR, backKb("back_to_main"));
    return;
  }
  const username = match[1];
  ctx.session.data = { username };
  await sendTracked(
    ctx,
    `✅ Qabul qilindi: <b>@${username}</b>\n\n📅 Necha oylik Premium xarid qilmoqchisiz?\n` +
      `Faqat raqam yozing: <b>3, 6, 12</b>`,
    backKb("back_to_main")
  );
  ctx.session.step = STEP.PREMIUM_MONTHS;
}

export async function handlePremiumMonthsText(_bot: Bot<MyContext>, ctx: MyContext): Promise<void> {
  const text = (ctx.message?.text ?? "").trim();
  const months = parseInt(text, 10);
  if (!ALLOWED_MONTHS.includes(months)) {
    await sendTracked(ctx, PREMIUM_INVALID_MONTHS, backKb("back_to_main"));
    return;
  }

  const { username } = ctx.session.data as { username?: string };
  if (!username) {
    ctx.session.step = undefined;
    return;
  }

  const uzs = MONTH_STAR_COST[months] * getStarPrice();
  const userId = ctx.from!.id;

  const remaining = await tryDeductBalance(userId, uzs, "premium");
  if (remaining === null) {
    const balance = await getBalance(userId);
    await sendTracked(
      ctx,
      fmt(PREMIUM_INSUFFICIENT_BALANCE, { required: uzs, balance }),
      backKb("back_to_main")
    );
    ctx.session.step = undefined;
    return;
  }

  await sendTracked(ctx, PREMIUM_CONFIRMING_ORDER);

  try {
    const prices = await getPremiumPrices();
    const entry = prices?.[`months${months}`];
    if (!entry?.ton) throw new Error(`API_ERROR: ${months} oylik Premium narxi topilmadi`);
    const priceTon = parseFloat(entry.ton);

    const wallet = await getWallet();
    if (wallet.balanceTon < priceTon) {
      await refundBalance(userId, uzs);
      await sendLog(
        `⚠️ <b>TON YETMAYAPTI</b> (Premium)\nHamyon: <code>${wallet.balanceTon.toFixed(4)}</code> TON`
      );
      await sendTracked(ctx, fmt(ERROR_INSUFFICIENT_TON, { support: config.supportBot }), successKb());
      ctx.session.step = undefined;
      return;
    }

    const txData = await buyPremium(username, months);
    if (!txData) throw new Error("API_ERROR: Premium tranzaksiyasini yaratib bo'lmadi");

    const job = {
      type: "premium",
      buyer_id: userId,
      buyer_username: ctx.from?.username ?? "no_username",
      recipient_username: username,
      months,
      ton: priceTon,
      uzs,
      tx: txData.transaction ?? txData,
    };
    await addPendingTx("premium", JSON.stringify(job), now());

    const position = await getQueueSize();
    await sendTracked(
      ctx,
      fmt(PREMIUM_QUEUED, {
        username,
        months,
        uzs,
        position,
        wait_time: position * config.txDelaySec,
      }),
      successKb()
    );
  } catch (err) {
    await refundBalance(userId, uzs);
    await sendLog(
      `❌ <b>PREMIUM XARIDIDA XATO</b>\n👤 <code>${userId}</code>\n` +
        `💵 ${uzs} so'm qaytarildi\n⚠️ <code>${(err as Error).message}</code>`
    );
    await sendTracked(ctx, fmt(ERROR_UNKNOWN, { support: config.supportBot }), successKb());
  }

  ctx.session.step = undefined;
  ctx.session.data = {};
}
