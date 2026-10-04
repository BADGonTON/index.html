import { Bot } from "grammy";
import { MyContext } from "../session";
import { sendFresh, deleteLastBotMessage } from "../ui";
import { isAdmin } from "../../config";
import {
  isSubscriptionRequired,
  isMember,
  getChannel,
  getChannelUrl,
} from "../../services/subscription";
import { getOrCreateUser, markChannelJoined, clearChannelJoined } from "../../db/repo/users";
import { getActiveContest, countReferral, countUserInvites } from "../../db/repo/contest";
import { notifyUser } from "../../services/logger";
import { fmt, SUB_REQUIRED, SUB_NOT_YET, SUB_WELCOME, CONTEST_NEW_INVITE } from "../texts";
import { subscribeKb } from "../keyboards";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  MAJBURIY OBUNA DARVOZASI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Konkurs vaqtida bot kanalga a'zo bo'lmagan odamni ichkariga qo'ymaydi.
 * A'zo bo'lgach esa uni taklif qilgan odamning hisobiga BITTA taklif
 * yoziladi — aynan shu joy konkursni soxta akkauntlardan himoya qiladi.
 *
 * TARTIB: oferta darvozasidan KEYIN turadi. Rozilik bermagan odam avval
 * ofertani ko'rishi kerak, kanal esa undan keyingi qadam.
 *
 * TEZLIK: a'zolik bir marta tekshiriladi va bazaga yoziladi
 * (`users.channel_joined_at`), keyin sessiyada eslab qolinadi — ya'ni
 * har bir xabarda Telegramga so'rov yuborilmaydi.
 */

/** Darvozadan o'tishga ruxsat etilgan yagona tugma. */
const CHECK = "sub_check";

export function subscriptionGate() {
  return async (ctx: MyContext, next: () => Promise<void>): Promise<void> => {
    if (!ctx.from || ctx.from.is_bot) return next();

    // Darvoza o'chiq bo'lsa bot mutlaqo odatdagidek ishlaydi.
    if (!isSubscriptionRequired()) return next();

    // Adminlar hech qachon to'xtatilmaydi — aks holda kanalni
    // sozlayotgan odam o'z darvozasi ortida qolib ketardi.
    if (isAdmin(ctx.from.id)) return next();

    if (ctx.session.subOk) return next();
    if (ctx.callbackQuery?.data === CHECK) return next();

    const user = await getOrCreateUser(ctx.from.id, ctx.from.username ?? null);
    if (user.channel_joined_at > 0) {
      ctx.session.subOk = true;
      return next();
    }

    await deleteLastBotMessage(ctx);
    await sendFresh(
      ctx,
      fmt(SUB_REQUIRED, { channel: getChannel() }),
      subscribeKb(getChannelUrl())
    );
    if (ctx.callbackQuery) await ctx.answerCallbackQuery();
  };
}

export function registerSubscriptionHandlers(bot: Bot<MyContext>): void {
  bot.callbackQuery(CHECK, async (ctx) => {
    const userId = ctx.from.id;
    const member = await isMember(userId);

    // `null` — tekshirib bo'lmadi (bot kanalda admin emas, kanal
    // o'chirilgan va h.k.). Bu BIZNING sozlama xatomiz, shuning uchun
    // foydalanuvchini to'smaymiz.
    if (member === null) {
      ctx.session.subOk = true;
      await ctx.answerCallbackQuery();
      await showWelcome(ctx);
      return;
    }

    if (!member) {
      await ctx.answerCallbackQuery({ text: SUB_NOT_YET, show_alert: true });
      return;
    }

    await markChannelJoined(userId);
    ctx.session.subOk = true;
    await ctx.answerCallbackQuery();

    await creditContestReferral(userId);
    await showWelcome(ctx);
  });
}

/**
 * Taklifni konkurs hisobiga yozadi.
 *
 * Faqat shu yerda chaqiriladi — ya'ni taklif HAR DOIM kanalga a'zo
 * bo'lgandan keyin sanaladi, boshqa hech qanday yo'l bilan emas.
 */
async function creditContestReferral(userId: number): Promise<void> {
  const contest = await getActiveContest();
  if (!contest) return;

  const user = await getOrCreateUser(userId);
  if (!user.referrer_id) return;

  const counted = await countReferral(contest.id, user.referrer_id, userId);
  if (!counted) return;

  // Taklif qilgan odamga xabar beramiz: konkursda bu eng kuchli
  // rag'bat — odam hisobi o'sganini darhol ko'radi.
  const total = await countUserInvites(contest.id, user.referrer_id);
  await notifyUser(
    user.referrer_id,
    fmt(CONTEST_NEW_INVITE, { title: contest.title, invites: total })
  );
}

async function showWelcome(ctx: MyContext): Promise<void> {
  await deleteLastBotMessage(ctx);
  await sendFresh(ctx, SUB_WELCOME);
}

/**
 * Darvoza o'chirilganda yoki kanal almashganda belgilarni tozalaydi.
 *
 * Busiz: eski kanalga a'zo bo'lgan odam yangisiga a'zo bo'lmasdan ham
 * o'tib ketardi.
 */
export async function resetChannelChecks(userIds: number[]): Promise<void> {
  for (const id of userIds) await clearChannelJoined(id);
}
