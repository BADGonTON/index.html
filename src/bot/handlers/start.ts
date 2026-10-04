import { Bot } from "grammy";
import { MyContext } from "../session";
import { renderMenu, sendFresh, deleteLastBotMessage } from "../ui";
import { getOrCreateUser, getBanRemaining } from "../../db/repo/users";
import { STEP } from "../steps";
import {
  fmt,
  START_MESSAGE,
  BALANCE_MESSAGE,
  REFERRAL_MESSAGE,
  RENT_INTRO,
  ENTER_AMOUNT,
  PAYMENT_BANNED,
} from "../texts";
import { startKb, balanceKb, backKb, rentKb, referralKb } from "../keyboards";
import { getActiveContest, countUserInvites } from "../../db/repo/contest";

function escapeHtml(text: string): string {
  return String(text ?? "").replace(/[&<>]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string
  );
}

export function registerStartHandlers(bot: Bot<MyContext>): void {
  bot.command("start", async (ctx) => {
    ctx.session.step = undefined;
    ctx.session.data = {};

    const payload = (ctx.message?.text ?? "").split(" ")[1];

    // /start 12345 — referal havolasi
    let refId: number | null = null;
    if (payload && /^\d+$/.test(payload)) {
      const parsed = parseInt(payload, 10);
      if (parsed !== ctx.from?.id) refId = parsed;
    }

    const user = await getOrCreateUser(ctx.from!.id, ctx.from?.username ?? null, refId);

    // /start pay — Mini App'dan "Balansni to'ldirish" bosilganda keladi.
    // Foydalanuvchini menyular bo'ylab yurgizmasdan, TO'G'RIDAN-TO'G'RI
    // summa so'rash bosqichiga olib kiramiz.
    if (payload === "pay") {
      const remaining = await getBanRemaining(ctx.from!.id);
      if (remaining > 0) {
        await renderMenu(
          ctx,
          fmt(PAYMENT_BANNED, { minutes: Math.ceil(remaining / 60) }),
          backKb("balance")
        );
        return;
      }
      await renderMenu(ctx, ENTER_AMOUNT, backKb("balance"));
      ctx.session.step = STEP.PAY_AMOUNT;
      return;
    }

    // /start HAR DOIM chatning oxirida chiqadi.
    //
    // Ilgari u oxirgi bot xabarini tahrirlardi. Lekin oraliqda boshqa
    // xabarlar (buyurtma bajarildi, chek namunasi) tushgan bo'lsa, menyu
    // ularning ORASIDA yoki YUQORISIDA paydo bo'lardi va chat chalkash
    // ko'rinardi. Endi eski menyu o'chiriladi, yangisi pastda chiqadi.
    await deleteLastBotMessage(ctx);
    await sendFresh(
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

    // Konkurs ketayotgan bo'lsa shu yerda "Liderlar" tugmasi qo'shiladi
    // va necha odam taklif qilgani ko'rinadi — referal ekrani
    // konkursning tabiiy joyi.
    const contest = await getActiveContest();
    const invites = contest ? await countUserInvites(contest.id, ctx.from!.id) : 0;

    await renderMenu(
      ctx,
      fmt(REFERRAL_MESSAGE, { link, ref_earned: user.ref_earned }) +
        (contest
          ? `\n\n\u{1F3C6} <b>${escapeHtml(contest.title)}</b>\n` +
            `\u{1F465} Takliflaringiz: <b>${invites}</b> ta`
          : ""),
      referralKb(Boolean(contest))
    );
    await ctx.answerCallbackQuery();
  });

  // Gift Arenda haqida qisqacha + Mini App tugmasi
  bot.callbackQuery("rent", async (ctx) => {
    const user = await getOrCreateUser(ctx.from!.id, ctx.from?.username ?? null);
    await renderMenu(ctx, fmt(RENT_INTRO, { balance: user.balance.toLocaleString("ru-RU") }), rentKb());
    await ctx.answerCallbackQuery();
  });
}
