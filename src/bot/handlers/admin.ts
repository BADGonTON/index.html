import { Bot, GrammyError } from "grammy";
import { MyContext } from "../session";
import { renderMenu, sendTracked } from "../ui";
import { isAdmin } from "../../config";
import { isMaintenance } from "../../services/maintenance";
import { STEP } from "../steps";
import {
  fmt,
  ADMIN_PANEL,
  ADMIN_ADD_BALANCE,
  ADMIN_SUB_BALANCE,
  ADMIN_BAN_USER,
  ADMIN_SET_PRICE,
  ADMIN_PRICE_UPDATED,
  ADMIN_BALANCE_ADDED,
  ADMIN_BALANCE_REMOVED,
  ADMIN_USER_BANNED,
  ADMIN_USER_UNBANNED,
  ADMIN_INVALID_FORMAT,
  ADMIN_BROADCAST_PROMPT,
  ADMIN_BROADCAST_CANCELLED,
  ADMIN_BROADCAST_CONFIRM,
  ADMIN_BROADCAST_STARTED,
  ADMIN_BROADCAST_DONE,
  ADMIN_SET_TON_RATE,
  ADMIN_SET_SERVICE_FEE,
  ADMIN_SET_EXTEND_MIN_DAYS,
  ADMIN_SET_EXTEND_FEE,
  ADMIN_RENT_STATS,
} from "../texts";
import { adminKb, adminBackKb, broadcastConfirmKb, giftAdminListKb } from "../keyboards";
import {
  banUser,
  creditBalance,
  getTotalUsers,
  getUserIdsAfter,
} from "../../db/repo/users";
import { getQueueSize, getTotalOrders, updateTxStatus } from "../../db/repo/transactions";
import { addGift, deleteGift, listGifts } from "../../db/repo/gifts";
import { getRentQueueSize } from "../../db/repo/rentals";
import { pool } from "../../db/pool";
import { getStarPrice, setStarPrice } from "../../services/starPrice";
import {
  getTonRateUzs,
  getServiceFeeUzs,
  setTonRateUzs,
  setServiceFeeUzs,
  getExtendMinDays,
  setExtendMinDays,
  getExtendFeeUzs,
  setExtendFeeUzs,
} from "../../services/pricing";
import { catalogStats } from "../../services/catalog";
import { sendLog, notifyUser } from "../../services/logger";
import { runTelegramChecks, formatChecksForTelegram } from "../../services/telegramCheck";


/**
 * Yetib bormagan xabar sababini AJRATADI.
 *
 * Ilgari har qanday xato "bloklagan" deb hisoblanardi — shuning uchun
 * eski bazadan ko'chirilgan, botga hech qachon /start bermagan
 * foydalanuvchilar ham "bloklagan" bo'lib ko'rinardi. Telegram bu ikkisini
 * turli javob bilan ajratadi.
 */
function broadcastFailureKind(err: unknown): "blocked" | "no_chat" | "other" {
  if (!(err instanceof GrammyError)) return "other";
  const d = err.description.toLowerCase();
  if (d.includes("blocked by the user")) return "blocked";
  if (d.includes("user is deactivated")) return "blocked";
  if (d.includes("can't initiate conversation")) return "no_chat";
  if (d.includes("chat not found")) return "no_chat";
  return "other";
}

/**
 * Broadcast'ning o'zi — fon jarayoni.
 *
 * Foydalanuvchilarni SAHIFALAB o'qiymiz: 200 000 ta ID ni bir vaqtda RAMga
 * yuklamaymiz. Har sekundda BROADCAST_BATCH ta xabar yuboriladi, shu tufayli
 * Telegram limitiga urilmaymiz.
 */
async function runBroadcast(
  ctx: MyContext,
  fromChatId: number,
  messageId: number,
  total: number
): Promise<void> {
  let cursor = 0;
  let success = 0;
  let blocked = 0;
  let noChat = 0;
  let other = 0;
  let firstOtherError = "";

  for (;;) {
    const batch = await getUserIdsAfter(cursor, BROADCAST_BATCH);
    if (batch.length === 0) break;
    cursor = batch[batch.length - 1];

    const results = await Promise.allSettled(
      batch.map((userId) => ctx.api.copyMessage(userId, fromChatId, messageId))
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        success++;
        continue;
      }
      switch (broadcastFailureKind(r.reason)) {
        case "blocked":
          blocked++;
          break;
        case "no_chat":
          noChat++;
          break;
        default:
          other++;
          if (!firstOtherError) firstOtherError = String((r.reason as Error)?.message ?? r.reason);
      }
    }

    await new Promise((r) => setTimeout(r, BROADCAST_PAUSE_MS));
  }

  const failed = blocked + noChat + other;

  // Sabablar ro'yxati: faqat nol bo'lmaganlari ko'rinadi.
  const lines: string[] = [];
  if (blocked) lines.push(`   • Botni bloklagan: <b>${blocked}</b>`);
  if (noChat) lines.push(`   • Botga hech qachon yozmagan: <b>${noChat}</b>`);
  if (other) lines.push(`   • Boshqa xato: <b>${other}</b>`);
  const breakdown = lines.join("\n");

  await ctx.api
    .sendMessage(ctx.chat!.id, fmt(ADMIN_BROADCAST_DONE, { total, success, failed, breakdown }), {
      parse_mode: "HTML",
    })
    .catch(() => {});

  await sendLog(
    `📢 Broadcast yakunlandi. Jami ${total} | ✅ ${success} | ❌ ${failed}` +
      (blocked ? ` | bloklagan ${blocked}` : "") +
      (noChat ? ` | yozmagan ${noChat}` : "") +
      (other ? ` | boshqa ${other}: ${firstOtherError}` : "")
  );
}

/** Broadcast: Telegram soniyasiga ~30 xabarga ruxsat beradi. 25/s xavfsiz tezlik. */
const BROADCAST_BATCH = 25;
const BROADCAST_PAUSE_MS = 1000;

async function renderAdminPanel(ctx: MyContext): Promise<void> {
  const [totalUsers, totalOrders, pendingTxs, maintenance] = await Promise.all([
    getTotalUsers(),
    getTotalOrders(),
    getQueueSize(),
    isMaintenance(),
  ]);
  await renderMenu(
    ctx,
    fmt(ADMIN_PANEL, {
      price: getStarPrice(),
      total_users: totalUsers,
      total_orders: totalOrders,
      pending_txs: pendingTxs,
      // Panelning tepasida rejim holati ko'rinib tursin — admin uni
      // yoqib qo'ygani esidan chiqib qolmasligi uchun.
      status: maintenance ? "🚧 TEXNIK ISHLAR REJIMI YOQILGAN" : "✅ Bot ochiq",
    }),
    adminKb(maintenance)
  );
}

/** Har bir admin callback'i uchun bir xil himoya. */
function adminOnly(handler: (ctx: MyContext) => Promise<void>) {
  return async (ctx: MyContext) => {
    if (!isAdmin(ctx.from!.id)) {
      await ctx.answerCallbackQuery({ text: "Ruxsat yo'q", show_alert: true }).catch(() => {});
      return;
    }
    await handler(ctx);
  };
}

export function registerAdminHandlers(bot: Bot<MyContext>): void {
  bot.command("admin", async (ctx) => {
    if (!isAdmin(ctx.from!.id)) return;
    ctx.session.step = undefined;
    ctx.session.data = {};
    await renderAdminPanel(ctx);
  });

  // Telegram bog'lanishi bo'yicha to'liq diagnostika.
  // Mini App ochilmasa — birinchi navbatda shu buyruq ishlatiladi.
  bot.command("diag", async (ctx) => {
    if (!isAdmin(ctx.from!.id)) return;
    const waiting = await ctx.reply("🔧 Tekshirilmoqda...");
    const results = await runTelegramChecks(ctx.api);
    await ctx.api
      .editMessageText(ctx.chat!.id, waiting.message_id, formatChecksForTelegram(results), {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      })
      .catch(() => ctx.reply(formatChecksForTelegram(results), { parse_mode: "HTML" }));
  });

  bot.callbackQuery(
    "admin_panel",
    adminOnly(async (ctx) => {
      await renderAdminPanel(ctx);
      await ctx.answerCallbackQuery();
    })
  );

  // --- Oddiy "so'rov → bosqich" tugmalari ---
  const prompts: Array<[string, string, string]> = [
    ["admin_add", ADMIN_ADD_BALANCE, STEP.ADMIN_ADD_BALANCE],
    ["admin_sub", ADMIN_SUB_BALANCE, STEP.ADMIN_SUB_BALANCE],
    ["admin_ban", ADMIN_BAN_USER, STEP.ADMIN_BAN_USER],
  ];
  for (const [callback, text, step] of prompts) {
    bot.callbackQuery(
      callback,
      adminOnly(async (ctx) => {
        await sendTracked(ctx, text, adminBackKb());
        ctx.session.step = step;
        await ctx.answerCallbackQuery();
      })
    );
  }

  bot.callbackQuery(
    "admin_price",
    adminOnly(async (ctx) => {
      await sendTracked(ctx, fmt(ADMIN_SET_PRICE, { price: getStarPrice() }), adminBackKb());
      ctx.session.step = STEP.ADMIN_SET_PRICE;
      await ctx.answerCallbackQuery();
    })
  );

  bot.callbackQuery(
    "admin_ton_rate",
    adminOnly(async (ctx) => {
      await sendTracked(
        ctx,
        fmt(ADMIN_SET_TON_RATE, { rate: getTonRateUzs().toLocaleString("ru-RU") }),
        adminBackKb()
      );
      ctx.session.step = STEP.ADMIN_SET_TON_RATE;
      await ctx.answerCallbackQuery();
    })
  );

  bot.callbackQuery(
    "admin_service_fee",
    adminOnly(async (ctx) => {
      await sendTracked(
        ctx,
        fmt(ADMIN_SET_SERVICE_FEE, { fee: getServiceFeeUzs().toLocaleString("ru-RU") }),
        adminBackKb()
      );
      ctx.session.step = STEP.ADMIN_SET_SERVICE_FEE;
      await ctx.answerCallbackQuery();
    })
  );

  bot.callbackQuery(
    "admin_extend_min_days",
    adminOnly(async (ctx) => {
      await sendTracked(
        ctx,
        fmt(ADMIN_SET_EXTEND_MIN_DAYS, { days: getExtendMinDays() }),
        adminBackKb()
      );
      ctx.session.step = STEP.ADMIN_SET_EXTEND_MIN_DAYS;
      await ctx.answerCallbackQuery();
    })
  );

  bot.callbackQuery(
    "admin_extend_fee",
    adminOnly(async (ctx) => {
      await sendTracked(
        ctx,
        fmt(ADMIN_SET_EXTEND_FEE, { fee: getExtendFeeUzs().toLocaleString("ru-RU") }),
        adminBackKb()
      );
      ctx.session.step = STEP.ADMIN_SET_EXTEND_FEE;
      await ctx.answerCallbackQuery();
    })
  );

  bot.callbackQuery(
    "admin_rent_stats",
    adminOnly(async (ctx) => {
      const catalog = catalogStats();
      const [{ rows }, queue] = await Promise.all([
        pool.query<{ status: string; count: number }>(
          `SELECT status, COUNT(*)::int AS count FROM rentals
            WHERE status IN ('linked','pending_link') GROUP BY status`
        ),
        getRentQueueSize(),
      ]);
      const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.count]));

      await renderMenu(
        ctx,
        fmt(ADMIN_RENT_STATS, {
          active: byStatus.linked ?? 0,
          pending: byStatus.pending_link ?? 0,
          queue,
          rate: getTonRateUzs().toLocaleString("ru-RU"),
          fee: getServiceFeeUzs().toLocaleString("ru-RU"),
          gifts: catalog.gifts,
          collections: catalog.collections,
          loading: catalog.pending,
          failing: catalog.failing,
          age: catalog.oldest_age_sec,
          interval: catalog.rate_interval_ms,
          limited: catalog.rate_limited ? " (hozir cheklangan)" : "",
        }),
        adminBackKb()
      );
      await ctx.answerCallbackQuery();
    })
  );

  // --- GIFT BOSHQARUVI ---
  bot.callbackQuery(
    "admin_gift_add",
    adminOnly(async (ctx) => {
      ctx.session.data = {};
      await sendTracked(
        ctx,
        "🎁 <b>Yangi gift qo'shish</b>\n\nGift ID sini yuboring (Fragment/Telegram'dan olingan raqamli ID).\n" +
          "Masalan <code>6046178578163303744</code>",
        adminBackKb()
      );
      ctx.session.step = STEP.ADMIN_GIFT_ADD_ID;
      await ctx.answerCallbackQuery();
    })
  );

  bot.callbackQuery(
    "admin_gift_list",
    adminOnly(async (ctx) => {
      const gifts = await listGifts(false);
      if (gifts.length === 0) {
        await renderMenu(ctx, "📋 Hozircha bazada gift yo'q.", adminBackKb());
      } else {
        const lines = gifts
          .map((g) => `• <code>${g.id}</code> — ${g.star_count}⭐️ ${g.active ? "" : "(nofaol)"}`)
          .join("\n");
        await renderMenu(
          ctx,
          `📋 <b>Gift ro'yxati</b> (${gifts.length} ta)\n\n${lines}\n\nO'chirish uchun bosing:`,
          giftAdminListKb(gifts)
        );
      }
      await ctx.answerCallbackQuery();
    })
  );

  bot.callbackQuery(
    /^admin_gift_del_(.+)$/,
    adminOnly(async (ctx) => {
      const id = (ctx as any).match![1] as string;
      await deleteGift(id);
      const gifts = await listGifts(false);
      await renderMenu(
        ctx,
        `✅ Gift o'chirildi: <code>${id}</code>`,
        gifts.length ? giftAdminListKb(gifts) : adminBackKb()
      );
      await ctx.answerCallbackQuery();
    })
  );

  // --- BROADCAST ---
  bot.callbackQuery(
    "admin_broadcast",
    adminOnly(async (ctx) => {
      await ctx.reply(ADMIN_BROADCAST_PROMPT, { parse_mode: "HTML" });
      ctx.session.step = STEP.ADMIN_BROADCAST_WAIT;
      await ctx.answerCallbackQuery();
    })
  );

  bot.callbackQuery("broadcast_cancel", async (ctx) => {
    ctx.session.step = undefined;
    ctx.session.data = {};
    await renderMenu(ctx, ADMIN_BROADCAST_CANCELLED, adminBackKb());
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(
    "broadcast_send",
    adminOnly(async (ctx) => {
      const { broadcastChatId, broadcastMessageId } = ctx.session.data as {
        broadcastChatId?: number;
        broadcastMessageId?: number;
      };
      ctx.session.step = undefined;
      ctx.session.data = {};

      if (!broadcastChatId || !broadcastMessageId) {
        await renderMenu(ctx, ADMIN_INVALID_FORMAT, adminBackKb());
        await ctx.answerCallbackQuery();
        return;
      }

      const total = await getTotalUsers();
      await renderMenu(ctx, fmt(ADMIN_BROADCAST_STARTED, { total }));
      await ctx.answerCallbackQuery();

      // Yuborishning O'ZI webhook so'rovi ichida BAJARILMAYDI.
      //
      // Telegram webhook'ga javob kelguncha o'sha chatning keyingi
      // yangilanishini yubormaydi. Broadcast esa minutlab davom etishi
      // mumkin — shunda Telegram "Read timeout expired" deb so'rovni
      // uzadi va O'SHA callback'ni QAYTA yuboradi: broadcast ikkinchi
      // marta ishlab ketardi. Shu sabab fonga chiqaramiz.
      void runBroadcast(ctx, broadcastChatId, broadcastMessageId, total);
    })
  );

  // --- Qolib ketgan TX larni qo'lda hal qilish ---
  bot.hears(/^\/done_(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx.from!.id)) return;
    const txId = parseInt(ctx.match![1], 10);
    await updateTxStatus(txId, "done");
    await ctx.reply(`✅ TX #${txId} 'done' deb belgilandi`);
  });

  bot.hears(/^\/retry_(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx.from!.id)) return;
    const txId = parseInt(ctx.match![1], 10);
    await updateTxStatus(txId, "pending");
    await ctx.reply(`🔄 TX #${txId} qayta 'pending' ga qaytarildi`);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  Matn bosqichlari (textRouter dan chaqiriladi)
// ═══════════════════════════════════════════════════════════════════════════

/** "12345 50000" ko'rinishidagi ikkita raqamni ajratadi. */
function parsePair(text: string): [number, number] | null {
  const parts = text.trim().split(/\s+/);
  if (parts.length !== 2) return null;
  const a = parseInt(parts[0], 10);
  const b = parseInt(parts[1], 10);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return [a, b];
}

export async function handleAdminAddBalanceText(ctx: MyContext): Promise<void> {
  const pair = parsePair(ctx.message?.text ?? "");
  if (!pair || pair[1] <= 0) {
    await ctx.reply(ADMIN_INVALID_FORMAT, { parse_mode: "HTML" });
    return;
  }
  const [userId, amount] = pair;
  await creditBalance(userId, amount, "admin", ctx.from!.id);
  await ctx.reply(fmt(ADMIN_BALANCE_ADDED, { user_id: userId, amount }), { parse_mode: "HTML" });
  await notifyUser(userId, `💰 Balansingizga <b>${amount.toLocaleString("ru-RU")}</b> so'm qo'shildi!`);
  ctx.session.step = undefined;
}

export async function handleAdminSubBalanceText(ctx: MyContext): Promise<void> {
  const pair = parsePair(ctx.message?.text ?? "");
  if (!pair || pair[1] <= 0) {
    await ctx.reply(ADMIN_INVALID_FORMAT, { parse_mode: "HTML" });
    return;
  }
  const [userId, amount] = pair;
  await creditBalance(userId, -amount, "admin", ctx.from!.id);
  await ctx.reply(fmt(ADMIN_BALANCE_REMOVED, { user_id: userId, amount }), { parse_mode: "HTML" });
  ctx.session.step = undefined;
}

export async function handleAdminBanText(ctx: MyContext): Promise<void> {
  const pair = parsePair(ctx.message?.text ?? "");
  if (!pair) {
    await ctx.reply(ADMIN_INVALID_FORMAT, { parse_mode: "HTML" });
    return;
  }
  const [userId, minutes] = pair;
  if (minutes === 0) {
    await banUser(userId, 0);
    await ctx.reply(fmt(ADMIN_USER_UNBANNED, { user_id: userId }), { parse_mode: "HTML" });
  } else {
    await banUser(userId, Math.floor(Date.now() / 1000) + minutes * 60);
    await ctx.reply(fmt(ADMIN_USER_BANNED, { user_id: userId, minutes }), { parse_mode: "HTML" });
  }
  ctx.session.step = undefined;
}

/** Raqamli sozlama bosqichlari uchun umumiy yordamchi. */
async function handleNumericSetting(
  ctx: MyContext,
  apply: (value: number) => Promise<void>,
  reply: (value: number) => string,
  min = 1
): Promise<void> {
  const text = (ctx.message?.text ?? "").trim();
  if (!/^\d+$/.test(text) || parseInt(text, 10) < min) {
    await ctx.reply(ADMIN_INVALID_FORMAT, { parse_mode: "HTML" });
    return;
  }
  const value = parseInt(text, 10);
  await apply(value);
  await ctx.reply(reply(value), { parse_mode: "HTML" });
  ctx.session.step = undefined;
}

export async function handleAdminSetPriceText(ctx: MyContext): Promise<void> {
  await handleNumericSetting(ctx, setStarPrice, (v) => fmt(ADMIN_PRICE_UPDATED, { price: v }));
}

export async function handleAdminSetTonRateText(ctx: MyContext): Promise<void> {
  await handleNumericSetting(
    ctx,
    setTonRateUzs,
    (v) => `✅ TON kursi yangilandi: <b>1 TON = ${v.toLocaleString("ru-RU")} so'm</b>`
  );
}

export async function handleAdminSetServiceFeeText(ctx: MyContext): Promise<void> {
  await handleNumericSetting(
    ctx,
    setServiceFeeUzs,
    (v) => `✅ Xizmat haqi yangilandi: <b>${v.toLocaleString("ru-RU")} so'm</b>`,
    0
  );
}

export async function handleAdminSetExtendMinDaysText(ctx: MyContext): Promise<void> {
  await handleNumericSetting(
    ctx,
    setExtendMinDays,
    (v) => `✅ Uzaytirishning eng kam muddati: <b>${v} kun</b>`,
    1
  );
}

export async function handleAdminSetExtendFeeText(ctx: MyContext): Promise<void> {
  await handleNumericSetting(
    ctx,
    setExtendFeeUzs,
    (v) =>
      v === 0
        ? "✅ Uzaytirish endi <b>xizmat haqisiz</b>"
        : `✅ Uzaytirish xizmat haqi: <b>${v.toLocaleString("ru-RU")} so'm</b>`,
    0
  );
}

export async function handleAdminBroadcastWaitText(ctx: MyContext): Promise<void> {
  if (ctx.message?.text === "/cancel") {
    ctx.session.step = undefined;
    await ctx.reply(ADMIN_BROADCAST_CANCELLED, { parse_mode: "HTML" });
    return;
  }
  ctx.session.data = {
    broadcastChatId: ctx.chat!.id,
    broadcastMessageId: ctx.message!.message_id,
  };
  const total = await getTotalUsers();
  await ctx.reply(fmt(ADMIN_BROADCAST_CONFIRM, { total }), {
    parse_mode: "HTML",
    reply_markup: broadcastConfirmKb(),
  });
  ctx.session.step = STEP.ADMIN_BROADCAST_CONFIRM;
}

export async function handleAdminGiftAddIdText(ctx: MyContext): Promise<void> {
  const id = (ctx.message?.text ?? "").trim();
  if (!/^\d+$/.test(id)) {
    await ctx.reply("❌ Gift ID faqat raqamlardan iborat bo'lishi kerak. Qaytadan kiriting:", {
      parse_mode: "HTML",
    });
    return;
  }
  ctx.session.data = { id };
  await ctx.reply("⭐️ Endi shu gift narxini (Stars miqdorida) kiriting.\nMasalan <code>50</code>", {
    parse_mode: "HTML",
  });
  ctx.session.step = STEP.ADMIN_GIFT_ADD_STARS;
}

export async function handleAdminGiftAddStarsText(ctx: MyContext): Promise<void> {
  const text = (ctx.message?.text ?? "").trim();
  if (!/^\d+$/.test(text) || parseInt(text, 10) < 1) {
    await ctx.reply("❌ Faqat musbat raqam kiriting. Masalan <code>50</code>", { parse_mode: "HTML" });
    return;
  }
  ctx.session.data = { ...ctx.session.data, star_count: parseInt(text, 10) };
  await ctx.reply(
    "🌟 Endi ushbu gift uchun <b>Premium custom-emoji ID</b>sini yuboring (ixtiyoriy).\n" +
      "Bunday ID yo'q bo'lsa — <code>-</code> yuboring.",
    { parse_mode: "HTML" }
  );
  ctx.session.step = STEP.ADMIN_GIFT_ADD_PREMIUM_ID;
}

export async function handleAdminGiftAddPremiumIdText(ctx: MyContext): Promise<void> {
  const text = (ctx.message?.text ?? "").trim();
  const premiumId = text === "-" ? null : text;
  const { id, star_count } = ctx.session.data as { id: string; star_count: number };

  const gift = await addGift({ id, star_count, premium_id: premiumId, emoji: "🎁" });
  await ctx.reply(
    `✅ <b>Gift qo'shildi!</b>\n\nID: <code>${gift.id}</code>\n` +
      `Narxi: <b>${gift.star_count}⭐️</b>\n` +
      `Premium ID: ${gift.premium_id ? `<code>${gift.premium_id}</code>` : "yo'q"}`,
    { parse_mode: "HTML", reply_markup: adminBackKb() }
  );
  ctx.session.step = undefined;
  ctx.session.data = {};
}
