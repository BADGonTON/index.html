import { InlineKeyboard } from "grammy";
import { BTN } from "./texts";
import { splitButtonLabel } from "./emoji";
import { config, miniAppUrl } from "../config";
import { GiftRow } from "../db/repo/gifts";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  BARCHA TUGMALAR SHU YERDA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tugma MATNIDA `<tg-emoji>` teglari ishlamaydi — Telegram ularni oddiy
 * matn sifatida ko'rsatadi. Shuning uchun premium emoji tugmaga alohida
 * `icon_custom_emoji_id` maydoni orqali qo'yiladi.
 *
 * Buni qo'lda yozib o'tirmaslik uchun `add()` yordamchisi tugma yozuvidagi
 * emojini o'zi ajratib oladi:
 *
 *     add(kb, "🎁 Gift olish", "gifts")
 *       → matn: "Gift olish"   ikonka: premium 🎁
 *
 * Ranglar: `.success()` yashil, `.primary()` ko'k, `.danger()` qizil.
 */

/** Tugma qo'shadi: yozuvdagi emoji avtomatik premium ikonkaga aylanadi. */
function add(kb: InlineKeyboard, label: string, data: string): InlineKeyboard {
  const { text, icon } = splitButtonLabel(label);
  return kb.text({ text, icon_custom_emoji_id: icon }, data);
}

/** Havola tugmasi (ikonkasi bilan). */
function addUrl(kb: InlineKeyboard, label: string, url: string): InlineKeyboard {
  const { text, icon } = splitButtonLabel(label);
  return kb.url({ text, icon_custom_emoji_id: icon }, url);
}

/** Mini App tugmasi (faqat PUBLIC_URL sozlangan bo'lsa ko'rinadi). */
function addMiniApp(kb: InlineKeyboard, label: string): InlineKeyboard {
  if (!config.publicUrl) return kb;
  const { text, icon } = splitButtonLabel(label);
  return kb.webApp({ text, icon_custom_emoji_id: icon }, miniAppUrl()).success();
}

// ═══════════════════════════════════════════════════════════════════════════
//  OFERTA (birinchi /start)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ofertaga rozilik ekrani.
 *
 * Yuqorida — hujjatni ochadigan havola tugmasi, pastda YASHIL "Roziman".
 * Rozilik berilmaguncha bot boshqa hech narsa qilmaydi.
 */
export function offerKb(): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (config.offerUrl) addUrl(kb, BTN.OFFER_READ, config.offerUrl).primary().row();
  add(kb, BTN.OFFER_ACCEPT, "offer_accept").success();
  return kb;
}

// ═══════════════════════════════════════════════════════════════════════════
//  ASOSIY MENYU
// ═══════════════════════════════════════════════════════════════════════════

export function startKb(): InlineKeyboard {
  const kb = new InlineKeyboard();

  add(kb, BTN.STARS, "stars").success();
  add(kb, BTN.GIFTS, "page_0").success().row();

  addMiniApp(kb, BTN.RENT).row();

  add(kb, BTN.BALANCE, "balance").success();
  add(kb, BTN.TG_PROFILE, "tg_profile").success().row();

  addUrl(kb, BTN.SUPPORT, config.supportBot).primary();
  return kb;
}

/** Stars bo'limi: Stars olish / Premium olish. */
export function starsMenuKb(): InlineKeyboard {
  const kb = new InlineKeyboard();
  add(kb, BTN.STARS_BUY, "stars_buy").success();
  add(kb, BTN.PREMIUM_BUY, "premium").success().row();
  add(kb, BTN.BACK, "back_to_main").primary();
  return kb;
}

export function rentKb(): InlineKeyboard {
  const kb = new InlineKeyboard();
  addMiniApp(kb, BTN.OPEN_APP).row();
  add(kb, BTN.BACK, "back_to_main").primary();
  return kb;
}

export function balanceKb(): InlineKeyboard {
  const kb = new InlineKeyboard();
  add(kb, BTN.PAY, "pay").success();
  add(kb, BTN.REFERRAL, "ref").success().row();
  add(kb, BTN.BACK, "back_to_main").primary();
  return kb;
}

export function cancelKb(unique: number): InlineKeyboard {
  return add(new InlineKeyboard(), BTN.CANCEL, `cancel:${unique}`).danger();
}

export function backKb(target = "back_to_main"): InlineKeyboard {
  return add(new InlineKeyboard(), BTN.BACK, target).primary();
}

export function successKb(): InlineKeyboard {
  const kb = new InlineKeyboard();
  addMiniApp(kb, BTN.RENT).row();
  add(kb, BTN.STARS, "stars").success();
  add(kb, BTN.GIFTS, "page_0").success().row();
  add(kb, BTN.MENU, "back_to_main").primary();
  return kb;
}

/** To'lov muvaffaqiyatli bo'lgach Mini App'ni to'g'ridan-to'g'ri ochish. */
export function rentDoneKb(): InlineKeyboard {
  const kb = new InlineKeyboard();
  addMiniApp(kb, BTN.MY_GIFTS).row();
  add(kb, BTN.MENU, "back_to_main").primary();
  return kb;
}

/** Faqat support havolasi (texnik ishlar xabari uchun). */
export function supportKb(): InlineKeyboard {
  return addUrl(new InlineKeyboard(), BTN.SUPPORT, config.supportBot).primary();
}

/** Balans yetmaganda — to'g'ridan-to'g'ri to'lovga o'tish. */
export function needBalanceKb(back = "back_to_main"): InlineKeyboard {
  const kb = new InlineKeyboard();
  add(kb, BTN.PAY, "pay").success().row();
  add(kb, BTN.BACK, back).primary();
  return kb;
}

// ═══════════════════════════════════════════════════════════════════════════
//  ADMIN PANEL
// ═══════════════════════════════════════════════════════════════════════════

export function adminKb(maintenance = false): InlineKeyboard {
  const kb = new InlineKeyboard();
  add(kb, BTN.ADMIN_ADD, "admin_add").success();
  add(kb, BTN.ADMIN_SUB, "admin_sub").danger().row();
  add(kb, BTN.ADMIN_BAN, "admin_ban").danger();
  add(kb, BTN.ADMIN_PRICE, "admin_price").primary().row();
  add(kb, BTN.ADMIN_TON_RATE, "admin_ton_rate").primary();
  add(kb, BTN.ADMIN_SERVICE_FEE, "admin_service_fee").primary().row();
  add(kb, BTN.ADMIN_GIFT_ADD, "admin_gift_add").success();
  add(kb, BTN.ADMIN_GIFT_LIST, "admin_gift_list").primary().row();
  add(kb, BTN.ADMIN_TG_ADD, "admin_tg_add").success();
  add(kb, BTN.ADMIN_TG_STATS, "admin_tg_stats").primary().row();
  add(kb, BTN.ADMIN_RENT_STATS, "admin_rent_stats").primary().row();
  add(kb, BTN.ADMIN_BROADCAST, "admin_broadcast").primary().row();

  // Texnik ishlar tugmasi holatga qarab o'zgaradi: yoqilgan bo'lsa
  // "Botni ochish" (yashil), o'chirilgan bo'lsa "Yoqish" (qizil).
  if (maintenance) add(kb, BTN.ADMIN_MAINTENANCE_OFF, "admin_maintenance").success();
  else add(kb, BTN.ADMIN_MAINTENANCE_ON, "admin_maintenance").danger();

  return kb;
}

export function broadcastConfirmKb(): InlineKeyboard {
  const kb = new InlineKeyboard();
  add(kb, BTN.BROADCAST_CONFIRM, "broadcast_send").success();
  add(kb, BTN.BROADCAST_CANCEL, "broadcast_cancel").danger();
  return kb;
}

export function adminBackKb(): InlineKeyboard {
  return add(new InlineKeyboard(), BTN.BACK, "admin_panel").primary();
}

// ═══════════════════════════════════════════════════════════════════════════
//  GIFT KATALOGI (Stars bilan sotib olinadigan sovg'alar)
// ═══════════════════════════════════════════════════════════════════════════

export function giftsPageKb(
  gifts: GiftRow[],
  page: number,
  hasPrev: boolean,
  hasNext: boolean
): InlineKeyboard {
  const kb = new InlineKeyboard();

  // Giftning O'Z premium emojisi bo'lsa — u ikonka bo'ladi va yozuvda
  // faqat narx qoladi. Bo'lmasa giftning oddiy emojisi yozuvda turadi:
  // hamma gift uchun bir xil umumiy ikonka qo'yishdan ko'ra, giftning
  // o'z belgisi ko'rinib turgani yaxshiroq.
  gifts.forEach((gift, i) => {
    kb.text(
      gift.premium_id
        ? { text: `${gift.star_count} ⭐️`, icon_custom_emoji_id: gift.premium_id }
        : { text: `${gift.emoji} ${gift.star_count} ⭐️` },
      `buy_${gift.id}_${gift.star_count}`
    ).success();
    if (i % 2 === 1) kb.row();
  });
  if (gifts.length % 2 !== 0) kb.row();

  // Pastki qator: orqaga / menyu / keyingi
  if (hasPrev) add(kb, BTN.PREV, `page_${page - 1}`).primary();
  else add(kb, BTN.MENU, "back_to_main").primary();

  if (hasNext) add(kb, BTN.NEXT, `page_${page + 1}`).primary();
  return kb;
}

export function giftAdminListKb(gifts: GiftRow[]): InlineKeyboard {
  const kb = new InlineKeyboard();

  for (const g of gifts) {
    kb.text(
      g.premium_id
        ? {
            text: `${g.star_count} ⭐️ — ${g.id.slice(0, 6)}…`,
            icon_custom_emoji_id: g.premium_id,
          }
        : { text: `${g.emoji} ${g.star_count} ⭐️ — ${g.id.slice(0, 6)}…` },
      `admin_gift_del_${g.id}`
    )
      .danger()
      .row();
  }
  add(kb, BTN.BACK, "admin_panel").primary();
  return kb;
}

// ═══════════════════════════════════════════════════════════════════════════
//  TELEGRAM PROFIL
// ═══════════════════════════════════════════════════════════════════════════

export function tgProfileBuyKb(): InlineKeyboard {
  const kb = new InlineKeyboard();
  add(kb, BTN.TG_BUY, "tg_buy").success().row();
  add(kb, BTN.BACK, "back_to_main").primary();
  return kb;
}

export function tgProfileNoneKb(): InlineKeyboard {
  return add(new InlineKeyboard(), BTN.BACK, "back_to_main").primary();
}

export function tgProfileGetCodeKb(accountId: number): InlineKeyboard {
  return add(new InlineKeyboard(), BTN.TG_GET_CODE, `tg_code_${accountId}`).success();
}

export function tgProfileRetryCodeKb(accountId: number): InlineKeyboard {
  return add(new InlineKeyboard(), BTN.TG_RECHECK, `tg_code_${accountId}`).primary();
}
