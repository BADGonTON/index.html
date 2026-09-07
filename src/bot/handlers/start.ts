import { Bot } from "grammy";
import { MyContext } from "../session";
import { renderMenu } from "../ui";
import { getOrCreateUser } from "../../db/repo/users";
import { fmt, START_MESSAGE, BALANCE_MESSAGE, REFERRAL_MESSAGE, RENT_INTRO } from "../texts";
import { startKb, balanceKb, backKb, rentKb } from "../keyboards";

export function registerStartHandlers(bot: Bot<MyContext>): void {
  bot.command("start", async (ctx) => {
    ctx.session.step = undefined;
    ctx.session.data = {};

    // /start 12345 — referal havolasi
    const payload = (ctx.message?.text ?? "").split(" ")[1];
    let refId: number | null = null;
    if (payload && /^\d+$/.test(payload)) {
      const parsed = parseInt(payload, 10);
      if (parsed !== ctx.from?.id) refId = parsed;
    }

    const user = await getOrCreateUser(ctx.from!.id, ctx.from?.username ?? null, refId);
    await renderMenu(
      ctx,
      fmt(START_MESSAGE, { name: ctx.from?.first_name ?? "", balance: user.balance }),
      startKb()
    );
  });

  bot.callbackQuery("back_to_main", async (ctx) => {
    ctx.session.step = undefined;
    ctx.session.data = {};
    const user = await getOrCreateUser(ctx.from!.id, ctx.from?.username ?? null);
    await renderMenu(
      ctx,
      fmt(START_MESSAGE, { name: ctx.from?.first_name ?? "", balance: user.balance }),
      startKb()
    );
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("balance", async (ctx) => {
    const user = await getOrCreateUser(ctx.from!.id, ctx.from?.username ?? null);
    await renderMenu(
      ctx,
      fmt(BALANCE_MESSAGE, { balance: user.balance, ref_earned: user.ref_earned }),
      balanceKb()
    );
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("ref", async (ctx) => {
    const user = await getOrCreateUser(ctx.from!.id, ctx.from?.username ?? null);
    const me = await ctx.api.getMe();
    const link = `https://t.me/${me.username}?start=${ctx.from!.id}`;
    await renderMenu(ctx, fmt(REFERRAL_MESSAGE, { link, ref_earned: user.ref_earned }), backKb("balance"));
    await ctx.answerCallbackQuery();
  });

  // Gift Arenda haqida qisqacha + Mini App tugmasi
  bot.callbackQuery("rent", async (ctx) => {
    const user = await getOrCreateUser(ctx.from!.id, ctx.from?.username ?? null);
    await renderMenu(ctx, fmt(RENT_INTRO, { balance: user.balance.toLocaleString("ru-RU") }), rentKb());
    await ctx.answerCallbackQuery();
  });
}
