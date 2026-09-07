import { Bot } from "grammy";
import { MyContext } from "../session";
import { renderMenu, sendTracked } from "../ui";
import {
  fmt,
  TG_PROFILE_MENU,
  TG_PROFILE_NONE_AVAILABLE,
  TG_PROFILE_INSUFFICIENT_BALANCE,
  TG_PROFILE_ASSIGNED,
  TG_PROFILE_CODE_WAITING,
  TG_PROFILE_CODE_RESULT,
  LOG_TG_ACCOUNT_SOLD,
} from "../texts";
import { tgProfileBuyKb, tgProfileNoneKb, tgProfileGetCodeKb, tgProfileRetryCodeKb, backKb, successKb } from "../keyboards";
import { peekNextAvailable, claimNextAvailable, releaseAccount, markSold, getTgAccount } from "../../db/repo/tgAccounts";
import { getOrCreateUser, tryDeductBalance } from "../../db/repo/users";
import { getLoginCode } from "../../services/telegramAccount";
import { sendLog } from "../../services/logger";
import { now } from "../../util/time";

export function registerTgProfileHandlers(bot: Bot<MyContext>): void {
  bot.callbackQuery("tg_profile", async (ctx) => {
    const next = await peekNextAvailable();
    if (!next) {
      await renderMenu(ctx, TG_PROFILE_NONE_AVAILABLE, tgProfileNoneKb());
    } else {
      await renderMenu(ctx, fmt(TG_PROFILE_MENU, { price: next.price }), tgProfileBuyKb());
    }
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("tg_buy", async (ctx) => {
    const account = await claimNextAvailable(ctx.from!.id);
    if (!account) {
      await renderMenu(ctx, TG_PROFILE_NONE_AVAILABLE, tgProfileNoneKb());
      await ctx.answerCallbackQuery();
      return;
    }

    // Atomik: balansni faqat yetarli bo'lsa yechadi (race-condition'siz)
    const newBalance = await tryDeductBalance(ctx.from!.id, account.price, "tg_profile", account.id);
    if (newBalance === null) {
      await releaseAccount(account.id);
      const user = await getOrCreateUser(ctx.from!.id, ctx.from?.username ?? null);
      await renderMenu(
        ctx,
        fmt(TG_PROFILE_INSUFFICIENT_BALANCE, { required: account.price, balance: user.balance }),
        backKb("balance")
      );
      await ctx.answerCallbackQuery();
      return;
    }

    await renderMenu(ctx, fmt(TG_PROFILE_ASSIGNED, { phone: account.phone }), tgProfileGetCodeKb(account.id));
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^tg_code_(\d+)$/, async (ctx) => {
    const accountId = parseInt(ctx.match![1], 10);
    const account = await getTgAccount(accountId);

    if (!account || account.status !== "pending" || account.buyer_id !== ctx.from!.id) {
      await ctx.answerCallbackQuery({
        text: "Bu akkaunt allaqachon yakunlangan yoki sizga tegishli emas.",
        show_alert: true,
      });
      return;
    }

    await ctx.answerCallbackQuery();
    await renderMenu(ctx, "⏳ Kod tekshirilmoqda...");

    const code = await getLoginCode(account.session_string);
    if (code && code.length === 5) {
      const formatted = code.split("").join(".");
      await markSold(account.id);
      await renderMenu(
        ctx,
        fmt(TG_PROFILE_CODE_RESULT, { code: formatted, two_fa: account.two_fa ?? "yo'q" }),
        successKb()
      );
      await sendLog(
        fmt(LOG_TG_ACCOUNT_SOLD, {
          buyer_username: ctx.from?.username ?? "no_username",
          buyer_id: ctx.from!.id,
          phone: account.phone,
          price: account.price,
          datetime: now(),
        })
      );
    } else {
      await renderMenu(ctx, TG_PROFILE_CODE_WAITING, tgProfileRetryCodeKb(account.id));
    }
  });
}
