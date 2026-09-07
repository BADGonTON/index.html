import { InlineKeyboard } from "grammy";
import { BTN } from "./texts";
import { config, miniAppUrl } from "../config";
import { GiftRow } from "../db/repo/gifts";
import { NAV_ICON_PREV, NAV_ICON_NEXT } from "./constants";

/**
 * BARCHA TUGMALAR SHU YERDA.
 *
 * Telegram Bot API tugmalarga rang berishga ruxsat beradi:
 *   .primary() — ko'k, .success() — yashil, .danger() — qizil
 * `.icon(customEmojiId)` esa tugma oldiga Premium custom-emoji qo'yadi.
 * Shu ikkisi botni "premium" ko'rinishga keltiradi.
 */

/** Mini App tugmasi (faqat PUBLIC_URL sozlangan bo'lsa ko'rinadi). */
function addMiniApp(kb: InlineKeyboard, label: string): InlineKeyboard {
  if (config.publicUrl) kb.webApp(label, miniAppUrl()).primary();
  return kb;
}

// --- Asosiy menyu: ataylab kam tugma (progressive disclosure) ---
export function startKb(): InlineKeyboard {
  const kb = new InlineKeyboard();
  addMiniApp(kb, BTN.RENT).row();
  kb.text(BTN.GIFTS, "page_0").primary().row();
  kb.text(BTN.STARS, "stars").success().text(BTN.PREMIUM, "premium").primary().row();
  kb.text(BTN.TG_PROFILE, "tg_profile").primary().row();
  kb.text(BTN.BALANCE, "balance").primary().url(BTN.SUPPORT, config.supportBot);
  return kb;
}

export function rentKb(): InlineKeyboard {
  const kb = new InlineKeyboard();
  addMiniApp(kb, "🖼 Ilovani ochish").row();
  kb.text(BTN.BACK, "back_to_main");
  return kb;
}

export function balanceKb(): InlineKeyboard {
  return new InlineKeyboard()
    .text(BTN.PAY, "pay")
    .success()
    .text(BTN.REFERRAL, "ref")
    .primary()
    .row()
    .text(BTN.BACK, "back_to_main");
}

export function cancelKb(unique: number): InlineKeyboard {
  return new InlineKeyboard().text(BTN.CANCEL, `cancel:${unique}`).danger();
}

export function backKb(target = "back_to_main"): InlineKeyboard {
  return new InlineKeyboard().text(BTN.BACK, target);
}

export function successKb(): InlineKeyboard {
  const kb = new InlineKeyboard();
  addMiniApp(kb, BTN.RENT).row();
  kb.text(BTN.STARS, "stars").success().text(BTN.PREMIUM, "premium").primary().row();
  kb.text(BTN.BACK, "back_to_main");
  return kb;
}

/** To'lov muvaffaqiyatli bo'lgach Mini App'ni to'g'ridan-to'g'ri ochish. */
export function rentDoneKb(): InlineKeyboard {
  const kb = new InlineKeyboard();
  addMiniApp(kb, BTN.MY_GIFTS).row();
  kb.text(BTN.BACK, "back_to_main");
  return kb;
}

// --- ADMIN PANEL ---
export function adminKb(): InlineKeyboard {
  return new InlineKeyboard()
    .text(BTN.ADMIN_ADD, "admin_add")
    .success()
    .text(BTN.ADMIN_SUB, "admin_sub")
    .danger()
    .row()
    .text(BTN.ADMIN_BAN, "admin_ban")
    .danger()
    .text(BTN.ADMIN_PRICE, "admin_price")
    .primary()
    .row()
    .text(BTN.ADMIN_TON_RATE, "admin_ton_rate")
    .primary()
    .text(BTN.ADMIN_SERVICE_FEE, "admin_service_fee")
    .primary()
    .row()
    .text("🎁 Gift qo'shish", "admin_gift_add")
    .success()
    .text("📋 Gift ro'yxati", "admin_gift_list")
    .primary()
    .row()
    .text("📱 Akkount qo'shish", "admin_tg_add")
    .success()
    .text("📊 Akkountlar", "admin_tg_stats")
    .primary()
    .row()
    .text(BTN.ADMIN_RENT_STATS, "admin_rent_stats")
    .primary()
    .row()
    .text(BTN.ADMIN_BROADCAST, "admin_broadcast")
    .primary();
}

export function broadcastConfirmKb(): InlineKeyboard {
  return new InlineKeyboard()
    .text(BTN.BROADCAST_CONFIRM, "broadcast_send")
    .success()
    .text(BTN.BROADCAST_CANCEL, "broadcast_cancel")
    .danger();
}

export function adminBackKb(): InlineKeyboard {
  return new InlineKeyboard().text(BTN.BACK, "admin_panel");
}

// --- GIFT KATALOGI (Stars bilan sotib olinadigan sovg'alar) ---
export function giftsPageKb(
  gifts: GiftRow[],
  page: number,
  hasPrev: boolean,
  hasNext: boolean
): InlineKeyboard {
  const kb = new InlineKeyboard();

  gifts.forEach((gift, i) => {
    const label = gift.premium_id ? ` ${gift.star_count} ⭐️` : `${gift.emoji} ${gift.star_count} ⭐️`;
    kb.text(
      { text: label, icon_custom_emoji_id: gift.premium_id ?? undefined },
      `buy_${gift.id}_${gift.star_count}`
    );
    if (i % 2 === 1) kb.row();
  });
  if (gifts.length % 2 !== 0) kb.row();

  if (hasPrev) {
    kb.text({ text: BTN.PREV, icon_custom_emoji_id: NAV_ICON_PREV }, `page_${page - 1}`).success();
  } else {
    kb.text({ text: BTN.MENU, icon_custom_emoji_id: NAV_ICON_PREV }, "back_to_main").success();
  }
  if (hasNext) {
    kb.text({ text: BTN.NEXT, icon_custom_emoji_id: NAV_ICON_NEXT }, `page_${page + 1}`).success();
  }
  return kb;
}

export function giftAdminListKb(gifts: GiftRow[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const g of gifts) {
    kb.text(
      {
        text: `🗑 ${g.star_count}⭐️ — ${g.id.slice(0, 6)}…`,
        icon_custom_emoji_id: g.premium_id ?? undefined,
      },
      `admin_gift_del_${g.id}`
    ).danger();
    kb.row();
  }
  kb.text(BTN.BACK, "admin_panel");
  return kb;
}

// --- TELEGRAM PROFIL ---
export function tgProfileBuyKb(): InlineKeyboard {
  return new InlineKeyboard().text(BTN.TG_BUY, "tg_buy").success().row().text(BTN.BACK, "back_to_main");
}

export function tgProfileNoneKb(): InlineKeyboard {
  return new InlineKeyboard().text(BTN.BACK, "back_to_main");
}

export function tgProfileGetCodeKb(accountId: number): InlineKeyboard {
  return new InlineKeyboard().text(BTN.TG_GET_CODE, `tg_code_${accountId}`).primary();
}

export function tgProfileRetryCodeKb(accountId: number): InlineKeyboard {
  return new InlineKeyboard().text(BTN.TG_RECHECK, `tg_code_${accountId}`).primary();
}
