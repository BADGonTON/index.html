import { Bot } from "grammy";
import { MyContext } from "../session";
import { renderMenu, sendTracked } from "../ui";
import { config } from "../../config";
import { STEP } from "../steps";
import { getStarPrice } from "../../services/starPrice";
import {
  fmt,
  STARS_MENU,
  STARS_SECTION,
  STARS_INVALID_QUANTITY,
  STARS_LIMIT_ERROR,
  STARS_ENTER_USERNAME,
  STARS_USERNAME_FORMAT_ERROR,
  STARS_INSUFFICIENT_BALANCE,
  STARS_CHECKING_RECIPIENT,
  STARS_RECIPIENT_NOT_FOUND,
  STARS_CONFIRMING_ORDER,
  STARS_QUEUED,
  ERROR_INSUFFICIENT_TON,
  ERROR_UNKNOWN,
} from "../texts";
import { backKb, successKb, starsMenuKb, needBalanceKb } from "../keyboards";
import { getBalance, tryDeductBalance, refundBalance } from "../../db/repo/users";
import { addPendingTx, getQueueSize } from "../../db/repo/transactions";
import { checkStarsRecipient, getStarsPriceTon, buyStars } from "../../services/marketapp";
import { getWallet } from "../../services/wallet";
import { sendLog } from "../../services/logger";
import { now } from "../../util/time";

const USERNAME_RE = /^@?([A-Za-z0-9_]{5,32})$/;

export function registerStarsHandlers(bot: Bot<MyContext>): void {
  // "Stars" — bo'lim menyusi: Stars olish / Premium olish
  bot.callbackQuery("stars", async (ctx) => {
    await renderMenu(ctx, STARS_SECTION, starsMenuKb());
    await ctx.answerCallbackQuery();
  });

  // "Stars olish" — miqdor so'raladi
  bot.callbackQuery("stars_buy", async (ctx) => {
    await renderMenu(
      ctx,
      fmt(STARS_MENU, {
        price: getStarPrice(),
        min_stars: config.starMin,
        max_stars: config.starMax,
      }),
      backKb("stars")
    );
    ctx.session.step = STEP.STARS_QTY;
    ctx.session.data = {};
    await ctx.answerCallbackQuery();
  });
}

export async function handleStarsQtyText(ctx: MyContext): Promise<void> {
  const text = (ctx.message?.text ?? "").trim();
  if (!/^\d+$/.test(text)) {
    await sendTracked(ctx, STARS_INVALID_QUANTITY, backKb("stars"));
    return;
  }

  const qty = parseInt(text, 10);
  if (qty < config.starMin || qty > config.starMax) {
    await sendTracked(
      ctx,
      fmt(STARS_LIMIT_ERROR, { min_stars: config.starMin, max_stars: config.starMax }),
      backKb("stars")
    );
    return;
  }

  const price = getStarPrice();
  const uzs = qty * price;
  ctx.session.data = { qty, uzs };
  await sendTracked(
    ctx,
    fmt(STARS_ENTER_USERNAME, { quantity: qty, price, total: uzs }),
    backKb("stars")
  );
  ctx.session.step = STEP.STARS_USERNAME;
}

export async function handleStarsUsernameText(_bot: Bot<MyContext>, ctx: MyContext): Promise<void> {
  const { qty, uzs } = ctx.session.data as { qty: number; uzs: number };
  if (!qty || !uzs) {
    ctx.session.step = undefined;
    return;
  }

  const match = (ctx.message?.text ?? "").trim().match(USERNAME_RE);
  if (!match) {
    await sendTracked(ctx, STARS_USERNAME_FORMAT_ERROR, backKb("stars"));
    return;
  }
  const username = match[1];
  const userId = ctx.from!.id;

  await sendTracked(ctx, STARS_CHECKING_RECIPIENT);
  const recipientInfo = await checkStarsRecipient(username);
  if (!recipientInfo) {
    await sendTracked(ctx, fmt(STARS_RECIPIENT_NOT_FOUND, { username }), backKb("stars"));
    ctx.session.step = undefined;
    return;
  }

  // Pulni ATOMIK yechamiz: shu yerdan keyin har qanday xatoda albatta qaytariladi.
  const remaining = await tryDeductBalance(userId, uzs, "stars");
  if (remaining === null) {
    const balance = await getBalance(userId);
    await sendTracked(
      ctx,
      fmt(STARS_INSUFFICIENT_BALANCE, { required: uzs, balance }),
      backKb("stars")
    );
    ctx.session.step = undefined;
    return;
  }

  await sendTracked(ctx, STARS_CONFIRMING_ORDER);

  try {
    const priceTon = await getStarsPriceTon(qty);
    if (!priceTon) throw new Error("API_ERROR: Stars narxini olib bo'lmadi");

    const wallet = await getWallet();
    if (wallet.balanceTon < priceTon) {
      await refundBalance(userId, uzs);
      await sendLog(
        `⚠️ <b>TON YETMAYAPTI</b>\nHamyon: <code>${wallet.balanceTon.toFixed(4)}</code> TON\n` +
          `Kerak: <code>${priceTon}</code> TON`
      );
      await sendTracked(ctx, fmt(ERROR_INSUFFICIENT_TON, { support: config.supportBot }), successKb());
      ctx.session.step = undefined;
      return;
    }

    const txData = await buyStars(username, qty);
    if (!txData) throw new Error("API_ERROR: Stars tranzaksiyasini yaratib bo'lmadi");

    const job = {
      type: "stars",
      buyer_id: userId,
      buyer_username: ctx.from?.username ?? "no_username",
      recipient_username: username,
      quantity: qty,
      ton: priceTon,
      uzs,
      tx: txData.transaction ?? txData,
    };
    await addPendingTx("stars", JSON.stringify(job), now());

    const position = await getQueueSize();
    await sendTracked(
      ctx,
      fmt(STARS_QUEUED, {
        username,
        quantity: qty,
        uzs,
        position,
        wait_time: position * config.txDelaySec,
      }),
      successKb()
    );
  } catch (err) {
    await refundBalance(userId, uzs);
    await sendLog(
      `❌ <b>STARS XARIDIDA XATO</b>\n👤 <code>${userId}</code>\n` +
        `💵 ${uzs} so'm qaytarildi\n⚠️ <code>${(err as Error).message}</code>`
    );
    await sendTracked(ctx, fmt(ERROR_UNKNOWN, { support: config.supportBot }), successKb());
  }

  ctx.session.step = undefined;
  ctx.session.data = {};
}
