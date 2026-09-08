import { Bot } from "grammy";
import { MyContext } from "../session";
import { renderMenu } from "../ui";
import { config } from "../../config";
import { acceptOffer, getOrCreateUser } from "../../db/repo/users";
import { fmt, OFFER_MESSAGE, OFFER_REQUIRED, START_MESSAGE } from "../texts";
import { offerKb, startKb } from "../keyboards";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  OMMAVIY OFERTA — botdan foydalanishdan OLDINGI rozilik
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Nega kerak: bot Telegram Stars va Telegram akkauntlari savdosi bilan
 * shug'ullanadi. Bunday xizmatlarda foydalanuvchi shartlar bilan tanishib,
 * rozilik bergan bo'lishi kerak — aks holda bot cheklanishi mumkin.
 *
 * Qanday ishlaydi: rozilik BAZADA saqlanadi (`users.offer_accepted_at`),
 * shuning uchun u faqat BIR MARTA so'raladi va botni qayta ishga tushirsangiz
 * ham yo'qolmaydi.
 *
 * Darvoza `offerGate()` middleware'ida: rozilik yo'q bo'lsa, /start va
 * "Roziman" tugmasidan boshqa HECH NARSA ishlamaydi.
 */

/** Rozilikdan oldin ham o'tishga ruxsat etilgan yagona tugma. */
const ACCEPT = "offer_accept";

/**
 * Rozilik tekshiruvi. Barcha ushlovchilardan OLDIN turadi.
 *
 * Tezlik: rozilik bergan foydalanuvchi uchun bu bitta yengil so'rov, u ham
 * sessiyada eslab qolinadi — ya'ni ikkinchi xabardan boshlab bazaga umuman
 * borilmaydi.
 */
export function offerGate() {
  return async (ctx: MyContext, next: () => Promise<void>): Promise<void> => {
    // Kanal postlari (to'lov kanali) va boshqa shaxssiz yangilanishlar.
    if (!ctx.from || ctx.from.is_bot) return next();

    // Sessiyada belgilangan bo'lsa — bazaga bormaymiz.
    if (ctx.session.offerOk) return next();

    // "Roziman" tugmasi darvozadan o'tadi — aks holda rozilik berib bo'lmasdi.
    if (ctx.callbackQuery?.data === ACCEPT) return next();

    const user = await getOrCreateUser(ctx.from.id, ctx.from.username ?? null);
    if (user.offer_accepted_at) {
      ctx.session.offerOk = true;
      return next();
    }

    // Rozilik yo'q. /start ofertani ko'rsatadi, qolgan hamma narsa to'xtaydi.
    if (isStart(ctx)) {
      await showOffer(ctx);
      return;
    }

    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: "Avval ofertaga rozilik bering", show_alert: true });
      await showOffer(ctx);
      return;
    }

    await renderMenu(ctx, OFFER_REQUIRED, offerKb());
  };
}

function isStart(ctx: MyContext): boolean {
  return /^\/start(\s|$)/.test(ctx.message?.text ?? "");
}

async function showOffer(ctx: MyContext): Promise<void> {
  await renderMenu(
    ctx,
    fmt(OFFER_MESSAGE, { name: ctx.from?.first_name ?? "foydalanuvchi" }),
    offerKb()
  );
}

export function registerOfferHandlers(bot: Bot<MyContext>): void {
  bot.callbackQuery(ACCEPT, async (ctx) => {
    await acceptOffer(ctx.from.id);
    ctx.session.offerOk = true;

    const user = await getOrCreateUser(ctx.from.id, ctx.from.username ?? null);
    await renderMenu(
      ctx,
      fmt(START_MESSAGE, { name: ctx.from.first_name ?? "", balance: user.balance }),
      startKb()
    );
    await ctx.answerCallbackQuery({ text: "Rahmat! Endi botdan foydalanishingiz mumkin" });
  });
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
