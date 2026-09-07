import { Bot } from "grammy";
import { MyContext } from "../session";
import { renderMenu, sendTracked } from "../ui";
import { config } from "../../config";
import { STEP } from "../steps";
import {
  fmt,
  ENTER_AMOUNT,
  INVALID_AMOUNT,
  MIN_AMOUNT_ERROR,
  PAYMENT_INSTRUCTION,
  PAYMENT_CANCELLED,
  PAYMENT_FOUND,
  PAYMENT_CONFIRMED,
  PAYMENT_BANNED,
  LOG_PAYMENT_CONFIRMED,
} from "../texts";
import { backKb, cancelKb, successKb } from "../keyboards";
import {
  allocatePayment,
  deletePayment,
  markPaymentFound,
  consumeFoundPayment,
} from "../../db/repo/payments";
import {
  addReferralBonus,
  creditBalance,
  getBanRemaining,
  getUser,
} from "../../db/repo/users";
import { notifyUser } from "../../services/logger";
import { now } from "../../util/time";

export function registerPaymentHandlers(bot: Bot<MyContext>): void {
  bot.callbackQuery("pay", async (ctx) => {
    const remaining = await getBanRemaining(ctx.from!.id);
    if (remaining > 0) {
      await renderMenu(
        ctx,
        fmt(PAYMENT_BANNED, { minutes: Math.ceil(remaining / 60) }),
        backKb("balance")
      );
      await ctx.answerCallbackQuery();
      return;
    }
    await renderMenu(ctx, ENTER_AMOUNT, backKb("balance"));
    ctx.session.step = STEP.PAY_AMOUNT;
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^cancel:(\d+)$/, async (ctx) => {
    await deletePayment(parseInt(ctx.match![1], 10));
    await renderMenu(ctx, PAYMENT_CANCELLED, backKb("balance"));
    await ctx.answerCallbackQuery();
  });

  // To'lov kanalidagi post: "#summa-51234" qatorini topib, to'lovni 'found' qilamiz
  bot.on("channel_post", async (ctx) => {
    if (ctx.chat.id !== config.paymentChannelId) return;
    const text = ctx.channelPost?.text;
    if (!text) return;

    const match = text.match(/#summa-\s*(\d+)/);
    if (!match) return;
    const summa = parseInt(match[1], 10);

    const channelIdStr = String(config.paymentChannelId).replace(/^-100/, "");
    const postLink = `https://t.me/c/${channelIdStr}/${ctx.channelPost!.message_id}`;

    // Atomik: faqat 'pending' bo'lsa 'found' bo'ladi, aks holda null.
    const payment = await markPaymentFound(summa, postLink);
    if (!payment) return;

    if (config.paymentReceiptSamplePhoto) {
      await ctx.api
        .sendPhoto(payment.user_id, config.paymentReceiptSamplePhoto, {
          caption: PAYMENT_FOUND,
          parse_mode: "HTML",
        })
        .catch(() => {});
    } else {
      await notifyUser(payment.user_id, PAYMENT_FOUND);
    }
  });

  // Chek rasmi kelganda — kutilayotgan to'lovni tasdiqlaymiz
  bot.on("message:photo", async (ctx) => {
    // Atomik: to'lov o'chiriladi va qaytariladi. Foydalanuvchi ketma-ket 5 ta
    // chek yuborsa ham balans FAQAT BIR MARTA to'ldiriladi.
    const payment = await consumeFoundPayment(ctx.from!.id);
    if (!payment) return;

    const user = await getUser(ctx.from!.id);
    const newBalance = await creditBalance(
      ctx.from!.id,
      payment.amount,
      "topup",
      payment.unique_sum
    );

    if (user?.referrer_id) {
      await addReferralBonus(
        user.referrer_id,
        Math.round(payment.amount * config.refPercent),
        payment.unique_sum
      );
    }

    if (config.adminChannelId) {
      const bestPhoto = ctx.message.photo[ctx.message.photo.length - 1];
      await ctx.api
        .sendPhoto(config.adminChannelId, bestPhoto.file_id, {
          caption: fmt(LOG_PAYMENT_CONFIRMED, {
            user_id: payment.user_id,
            amount: payment.amount,
            post_link: payment.post_link ?? "",
            datetime: now(),
          }),
          parse_mode: "HTML",
        })
        .catch(() => {});
    }

    await sendTracked(
      ctx,
      fmt(PAYMENT_CONFIRMED, { amount: payment.amount, balance: newBalance }),
      successKb()
    );
  });
}

export async function handlePayAmountText(_bot: Bot<MyContext>, ctx: MyContext): Promise<void> {
  const text = (ctx.message?.text ?? "").trim();
  if (!/^\d+$/.test(text)) {
    await sendTracked(ctx, INVALID_AMOUNT, backKb("balance"));
    return;
  }

  const amount = parseInt(text, 10);
  if (amount < config.minPayment) {
    await sendTracked(ctx, MIN_AMOUNT_ERROR, backKb("balance"));
    return;
  }

  // Bo'sh unikal summa bitta so'rovda topiladi va band qilinadi.
  // Muddati o'tsa, fon ishchisi (paymentSweeper) uni o'zi bekor qiladi —
  // shu sabab bu yerda setTimeout kerak emas va restartda hech narsa yo'qolmaydi.
  const unique = await allocatePayment(ctx.from!.id, amount);

  await sendTracked(
    ctx,
    fmt(PAYMENT_INSTRUCTION, {
      card_owner: config.cardOwner,
      card_number: config.cardNumber,
      unique_sum: unique,
    }),
    cancelKb(unique)
  );
  ctx.session.step = undefined;
}
