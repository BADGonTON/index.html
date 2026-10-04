import { Bot } from "grammy";
import { MyContext } from "../session";
import { renderMenu, sendFresh, deleteLastBotMessage } from "../ui";
import { config, isAdmin } from "../../config";
import { acceptOffer, getOrCreateUser, markChannelJoined } from "../../db/repo/users";
import {
  fmt,
  ENTRY_OFFER_AND_CHANNEL,
  ENTRY_OFFER_ONLY,
  ENTRY_CHANNEL_ONLY,
  ENTRY_BLOCKED,
  ENTRY_NOT_MEMBER,
  ENTRY_DONE,
  START_MESSAGE,
  CONTEST_NEW_INVITE,
} from "../texts";
import { entryKb, startKb } from "../keyboards";
import {
  isSubscriptionRequired,
  isMember,
  getChannel,
  getChannelUrl,
} from "../../services/subscription";
import { getActiveContest, countReferral, countUserInvites } from "../../db/repo/contest";
import { notifyUser } from "../../services/logger";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  KIRISH DARVOZASI — oferta va kanal a'zoligi BITTA ekranda
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Nega bitta: ilgari ikkita alohida darvoza bor edi va ularning tartibi
 * foydalanuvchini tuzoqqa tushirardi.
 *
 *   • "Roziman" tugmasi ofertaning darvozasidan o'tardi, lekin keyingi —
 *     kanal darvozasi uni TO'XTATARDI. Ya'ni tugma ushlovchisi umuman
 *     ishlamasdi va `acceptOffer()` chaqirilmasdi: rozilik BAZAGA
 *     YOZILMAY QOLARDI. Odam kanalga a'zo bo'lib, "tekshirish" ni bosgach,
 *     bot undan ofertani QAYTADAN so'rardi.
 *
 *   • A'zolik tasdiqlangach "endi /start bosing" degan xabar chiqardi —
 *     odam esa menyuni kutardi.
 *
 * Endi bitta ekran, bitta tugma: u ham rozilikni yozadi, ham a'zolikni
 * tekshiradi, keyin DARHOL menyuni ochadi.
 *
 * TEZLIK: ikkita belgi (rozilik va a'zolik) sessiyada eslab qolinadi,
 * shuning uchun o'tgan foydalanuvchi uchun bazaga umuman borilmaydi.
 */

/**
 * Darvozadan o'tishga ruxsat etilgan tugmalar.
 *
 * `offer_accept` va `sub_check` — ESKI nomlar. Ular saqlangan: yangilanishdan
 * oldin yuborilgan xabarlar foydalanuvchilarning chatida qolgan va o'sha
 * tugmalar baribir ishlashi kerak.
 */
const ENTRY_CALLBACKS = new Set(["entry_ok", "offer_accept", "sub_check"]);

interface Needs {
  offer: boolean;
  channel: boolean;
}

/**
 * `/start 12345` — referal havolasi.
 *
 * NEGA BU DARVOZADA: havolani bosgan YANGI odam avval kirish ekraniga
 * tushadi va darvoza `next()` ni CHAQIRMAYDI, ya'ni `/start` ushlovchisi
 * umuman ishlamaydi. Agar taklif qilgan odamni shu yerda yozmasak,
 * `referrer_id` BUTUNLAY YO'QOLADI — keyin odam kanalga a'zo bo'lsa ham
 * taklif hech kimning hisobiga tushmaydi va konkurs ishlamaydi.
 *
 * `getOrCreateUser` taklifchini faqat QATOR YARATILGANDA yozadi
 * (`ON CONFLICT` da faqat username yangilanadi), shuning uchun buni
 * darvozadan uzatish mavjud taklifchini almashtirib yubormaydi.
 */
function referrerFromStart(ctx: MyContext): number | null {
  const text = ctx.message?.text ?? "";
  if (!/^\/start(\s|$)/.test(text)) return null;

  const payload = text.split(" ")[1];
  if (!payload || !/^\d+$/.test(payload)) return null;

  const parsed = parseInt(payload, 10);
  return parsed === ctx.from?.id ? null : parsed;
}

/** Foydalanuvchidan nima talab qilinadi (hech narsa bo'lmasa — ikkisi ham false). */
async function entryNeeds(ctx: MyContext): Promise<Needs> {
  // Adminlar kanal darvozasidan o'tkaziladi: aks holda kanalni
  // sozlayotgan odam o'z darvozasi ortida qolib ketardi. Oferta esa
  // ularga ham taalluqli.
  const channelRequired = isSubscriptionRequired() && !isAdmin(ctx.from!.id);

  if (ctx.session.offerOk && (!channelRequired || ctx.session.subOk)) {
    return { offer: false, channel: false };
  }

  const user = await getOrCreateUser(
    ctx.from!.id,
    ctx.from!.username ?? null,
    referrerFromStart(ctx)
  );

  const offer = !user.offer_accepted_at;
  if (!offer) ctx.session.offerOk = true;

  const channel = channelRequired && user.channel_joined_at === 0;
  if (channelRequired && !channel) ctx.session.subOk = true;

  return { offer, channel };
}

export function entryGate() {
  return async (ctx: MyContext, next: () => Promise<void>): Promise<void> => {
    // Kanal postlari va boshqa shaxssiz yangilanishlar.
    if (!ctx.from || ctx.from.is_bot) return next();

    // Kirish tugmasi darvozadan o'tadi — aks holda uni bosib bo'lmasdi.
    if (ENTRY_CALLBACKS.has(ctx.callbackQuery?.data ?? "")) return next();

    const needs = await entryNeeds(ctx);
    if (!needs.offer && !needs.channel) return next();

    if (isStart(ctx)) {
      // /start kabi, kirish ekrani ham chatning OXIRIDA chiqadi.
      await deleteLastBotMessage(ctx);
      await showEntry(ctx, needs, { fresh: true });
      return;
    }

    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: ENTRY_BLOCKED, show_alert: true });
      await showEntry(ctx, needs);
      return;
    }

    await showEntry(ctx, needs);
  };
}

function isStart(ctx: MyContext): boolean {
  return /^\/start(\s|$)/.test(ctx.message?.text ?? "");
}

/** Talabga qarab mos ekranni chizadi. */
async function showEntry(
  ctx: MyContext,
  needs: Needs,
  opts: { fresh?: boolean } = {}
): Promise<void> {
  const name = ctx.from?.first_name ?? "foydalanuvchi";
  const channel = getChannel();

  let text: string;
  if (needs.offer && needs.channel) text = fmt(ENTRY_OFFER_AND_CHANNEL, { name, channel });
  else if (needs.offer) text = fmt(ENTRY_OFFER_ONLY, { name });
  else text = fmt(ENTRY_CHANNEL_ONLY, { channel });

  const kb = entryKb({
    offerUrl: needs.offer ? config.offerUrl : "",
    channelUrl: needs.channel ? getChannelUrl() : "",
    label: needs.offer ? "accept" : "check",
  });

  if (opts.fresh) await sendFresh(ctx, text, kb);
  else await renderMenu(ctx, text, kb);
}

export function registerEntryHandlers(bot: Bot<MyContext>): void {
  bot.callbackQuery([...ENTRY_CALLBACKS], async (ctx) => {
    const userId = ctx.from.id;
    const user = await getOrCreateUser(userId, ctx.from.username ?? null);

    // 1. ROZILIK. Tugmani bosgani — rozilik bergani, shuning uchun
    //    a'zolik tekshiruvidan OLDIN yoziladi: tekshiruv qanday
    //    tugasa ham, odamdan oferta ikkinchi marta so'ralmaydi.
    if (!user.offer_accepted_at) await acceptOffer(userId);
    ctx.session.offerOk = true;

    // 2. KANAL.
    const channelRequired = isSubscriptionRequired() && !isAdmin(userId);
    let justJoined = false;

    if (channelRequired && user.channel_joined_at === 0) {
      const member = await isMember(userId);

      if (member === false) {
        await ctx.answerCallbackQuery({ text: ENTRY_NOT_MEMBER, show_alert: true });
        // Rozilik allaqachon yozildi, shuning uchun ekranda endi faqat
        // kanal so'raladi.
        await showEntry(ctx, { offer: false, channel: true });
        return;
      }

      // `null` — tekshirib bo'lmadi (bot kanalda admin emas, kanal
      // o'chirilgan). Bu BIZNING sozlama xatomiz, foydalanuvchini
      // to'smaymiz; lekin a'zolik TASDIQLANMAGANI uchun bazaga
      // yozilmaydi va taklif ham sanalmaydi.
      if (member === true) {
        await markChannelJoined(userId);
        justJoined = true;
      }
      ctx.session.subOk = true;
    } else if (channelRequired) {
      ctx.session.subOk = true;
    }

    await ctx.answerCallbackQuery({ text: ENTRY_DONE });

    // 3. MENYU — darhol, "/start bosing" demasdan.
    const fresh = await getOrCreateUser(userId);
    await renderMenu(
      ctx,
      fmt(START_MESSAGE, { name: ctx.from.first_name ?? "", balance: fresh.balance }),
      startKb()
    );

    // Taklif FAQAT a'zolik aynan hozir tasdiqlangan bo'lsa sanaladi.
    if (justJoined) await creditContestReferral(userId);
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

/**
 * Oferta havolasi sozlanmaganini ishga tushishda bir marta ogohlantiradi.
 *
 * Havolasiz ham bot ishlaydi (rozilik so'raladi), lekin foydalanuvchi
 * hujjatni o'qiy olmaydi — bu esa ofertaning ma'nosini yo'qotadi.
 */
export function warnIfOfferUrlMissing(): void {
  if (!config.offerUrl) {
    console.warn(
      "⚠️  OFFER_URL sozlanmagan — foydalanuvchi ofertani o'qiy olmaydi.\n" +
        "    .env ga oferta havolasini qo'ying: OFFER_URL=https://..."
    );
  }
}
