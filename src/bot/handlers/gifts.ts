import { Bot } from "grammy";
import { MyContext } from "../session";
import { renderMenu } from "../ui";
import { config } from "../../config";
import { listGifts, GiftRow } from "../../db/repo/gifts";
import { giftsPageKb } from "../keyboards";
import { MAIN_MENU_TITLE } from "../texts";

/**
 * Stars bilan sotib olinadigan Telegram sovg'alari (Gift Arenda'dan farqli —
 * bu Telegram'ning o'z sovg'alari, `sendGift` orqali yuboriladi).
 *
 * Ro'yxat bazadagi giftlar + Telegram'ning rasmiy sovg'alaridan yig'iladi.
 * `getAvailableGifts` javobi 60 soniya keshlanadi — har sahifa almashtirilganda
 * Telegram'ga so'rov yuborilmaydi.
 */

const TELEGRAM_GIFTS_TTL_MS = 60_000;
let tgGiftsCache: { at: number; gifts: GiftRow[] } | null = null;

async function getTelegramGifts(ctx: MyContext): Promise<GiftRow[]> {
  if (tgGiftsCache && Date.now() - tgGiftsCache.at < TELEGRAM_GIFTS_TTL_MS) {
    return tgGiftsCache.gifts;
  }
  try {
    const available = await ctx.api.getAvailableGifts();
    const gifts: GiftRow[] = available.gifts.map((g) => ({
      id: g.id,
      star_count: g.star_count,
      emoji: g.sticker?.emoji ?? "🎁",
      premium_id: null,
      title: null,
      active: true,
      created_at: "",
    }));
    tgGiftsCache = { at: Date.now(), gifts };
    return gifts;
  } catch {
    return tgGiftsCache?.gifts ?? [];
  }
}

/**
 * Sotib olish mumkin bo'lgan sovg'alar ro'yxati.
 *
 * KATALOGNI BAZA BELGILAYDI. Nima sotilishini biz hal qilamiz: gift bazada
 * bo'lsa — sotiladi, bo'lmasa — yo'q.
 *
 * Telegram API'dan kelgan sovg'alar ro'yxatga QO'SHILMAYDI. Aks holda
 * Telegram o'z to'plamiga yangi sovg'a qo'shganda (masalan 200 yoki 500
 * Stars turadigan) u bizning ro'yxatimizda o'z-o'zidan paydo bo'lardi —
 * biz sotmoqchi bo'lmagan, premium emojisi ham yo'q gift.
 *
 * Telegram API baribir kerak, lekin faqat BITTA narsa uchun — NARX.
 * `sendGift` bot hisobidan aynan Telegram belgilagan miqdorni yechadi,
 * shuning uchun bazadagi narx eskirgan bo'lsa, foydalanuvchi kam to'lab,
 * farqni bot to'lab qolardi.
 *
 * Yangi gift qo'shish: admin panel → "➕ Gift qo'shish", yoki migratsiya
 * fayli (src/db/migrations/009_gift_emoji.sql ga o'xshab).
 */
function mergeGifts(dbGifts: GiftRow[], tgGifts: GiftRow[]): GiftRow[] {
  const priceById = new Map(tgGifts.map((g) => [g.id, g.star_count]));

  return dbGifts.map((db) => {
    const livePrice = priceById.get(db.id);
    return livePrice === undefined ? db : { ...db, star_count: livePrice };
  });
}

async function buildGiftsPage(ctx: MyContext, page: number) {
  const [dbGifts, tgGifts] = await Promise.all([listGifts(true), getTelegramGifts(ctx)]);

  const allGifts = mergeGifts(dbGifts, tgGifts).sort(
    (a, b) => a.star_count - b.star_count || a.id.localeCompare(b.id)
  );
  const totalPages = Math.max(1, Math.ceil(allGifts.length / config.itemsPerPage));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);

  const startIdx = safePage * config.itemsPerPage;
  const endIdx = startIdx + config.itemsPerPage;

  return {
    text: `${MAIN_MENU_TITLE}\n\n<i>(Sahifa: ${safePage + 1}/${totalPages})</i>`,
    keyboard: giftsPageKb(
      allGifts.slice(startIdx, endIdx),
      safePage,
      safePage > 0,
      endIdx < allGifts.length
    ),
  };
}

export function registerGiftHandlers(bot: Bot<MyContext>): void {
  bot.callbackQuery(/^page_(\d+)$/, async (ctx) => {
    const { text, keyboard } = await buildGiftsPage(ctx, parseInt(ctx.match![1], 10));
    await renderMenu(ctx, text, keyboard);
    await ctx.answerCallbackQuery();
  });

  // buy_<giftId>_<starCount>
  bot.callbackQuery(/^buy_(\d+)_(\d+)$/, async (ctx) => {
    const giftId = ctx.match![1];
    const starCount = parseInt(ctx.match![2], 10);
    try {
      await ctx.api.sendInvoice(
        ctx.from!.id,
        "Telegram Sovg'asi",
        "Tanlagan sovg'angizni xarid qilish uchun to'lovni tasdiqlang.",
        `gift_${giftId}`,
        "XTR",
        [{ label: "🎁 Sovg'a", amount: starCount }]
      );
      await ctx.answerCallbackQuery();
    } catch (err) {
      await ctx.answerCallbackQuery({
        text: `Hisob yaratilmadi: ${(err as Error).message}`,
        show_alert: true,
      });
    }
  });

  bot.on("pre_checkout_query", async (ctx) => {
    await ctx.answerPreCheckoutQuery(true);
  });

  bot.on("message:successful_payment", async (ctx) => {
    const payload = ctx.message.successful_payment.invoice_payload;
    if (!payload.startsWith("gift_")) return;
    const giftId = payload.slice("gift_".length);

    const dbGift = (await listGifts(false)).find((g) => g.id === giftId);
    const tgGift = dbGift ? null : (await getTelegramGifts(ctx)).find((g) => g.id === giftId);
    const giftEmoji = dbGift?.emoji ?? tgGift?.emoji ?? "🎁";

    try {
      await ctx.api.sendGift(ctx.from!.id, giftId, {
        text: `HozirOLbot dan siz uchun ${giftEmoji}`,
      });
      await ctx.reply("✅ To'lovingiz qabul qilindi va sovg'a yuborildi 😊");
    } catch (err) {
      // Stars allaqachon yechilgan — bu holat albatta adminga yetkazilishi kerak.
      const { sendLog } = await import("../../services/logger");
      await sendLog(
        `❌ <b>SOVG'A YUBORILMADI</b>\n👤 <code>${ctx.from!.id}</code>\n` +
          `🎁 <code>${giftId}</code> (${ctx.message.successful_payment.total_amount} ⭐️)\n` +
          `⚠️ <code>${(err as Error).message}</code>`
      );
      await ctx.reply(
        "⚠️ To'lov qabul qilindi, lekin sovg'ani yuborishda xatolik yuz berdi.\n" +
          "Administrator xabardor qilindi — tez orada hal qilinadi."
      );
    }
  });
}
