import { InlineKeyboard } from "grammy";
import { BTN } from "./texts";
import { splitButtonLabel } from "./emoji";
import { config, miniAppUrl } from "../config";

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
 *     add(kb, "👑 Premium olish", "premium")
 *       → matn: "Premium olish"   ikonka: premium 👑
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
/**
 * Kirish ekrani: oferta havolasi, kanal havolasi va BITTA tasdiq tugmasi.
 *
 * Havolalar faqat kerak bo'lganda qo'shiladi — bo'sh havolali tugma
 * Telegramda xato beradi.
 */
export function entryKb(opts: {
  offerUrl: string;
  channelUrl: string;
  label: "accept" | "check";
}): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (opts.offerUrl) addUrl(kb, BTN.OFFER_READ, opts.offerUrl).primary().row();
  if (opts.channelUrl) addUrl(kb, BTN.SUB_JOIN, opts.channelUrl).primary().row();
  add(
    kb,
    opts.label === "accept" ? BTN.OFFER_ACCEPT : BTN.ENTRY_CHECK,
    "entry_ok"
  ).success();
  return kb;
}

// ═══════════════════════════════════════════════════════════════════════════
//  ASOSIY MENYU
// ═══════════════════════════════════════════════════════════════════════════

export function startKb(): InlineKeyboard {
  const kb = new InlineKeyboard();

  // Stars va Premium — ikkisi ham to'g'ridan-to'g'ri xarid oqimiga
  // olib boradi. Ilgari ikkisi bitta "Stars" tugmasi ortida turardi,
  // ya'ni foydalanuvchi Premium uchun ikki marta bosardi.
  add(kb, BTN.STARS, "stars").success();
  add(kb, BTN.PREMIUM_BUY, "premium").success().row();

  addMiniApp(kb, BTN.RENT).row();

  add(kb, BTN.BALANCE, "balance").success();
  add(kb, BTN.TG_PROFILE, "tg_profile").success().row();

  addUrl(kb, BTN.SUPPORT, config.supportBot).primary();
  return kb;
}

export function rentKb(): InlineKeyboard {
  const kb = new InlineKeyboard();
  addMiniApp(kb, BTN.OPEN_APP).row();
  add(kb, BTN.BACK, "back_to_main").primary();
  return kb;
}

/**
 * Majburiy obuna ekrani.
 *
 * Yuqorida kanalga o'tish, pastda "A'zo bo'ldim". Havola bo'lmasa
 * (admin faqat username qo'ygan) faqat tekshirish tugmasi qoladi —
 * bo'sh havolali tugma Telegramda xato beradi.
 */


/** Referal ekrani: konkurs ketayotgan bo'lsa "Liderlar" ham chiqadi. */
export function referralKb(withLeaders: boolean): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (withLeaders) add(kb, BTN.LEADERS, "leaders").success().row();
  add(kb, BTN.BACK, "balance").primary();
  return kb;
}

/** Liderlar ekrani. */
export function leadersKb(): InlineKeyboard {
  const kb = new InlineKeyboard();
  add(kb, BTN.REFERRAL, "ref").success().row();
  add(kb, BTN.BACK, "balance").primary();
  return kb;
}

// ═══════════════════════════════════════════════════════════════════════════
//  KONKURS — ADMIN
// ═══════════════════════════════════════════════════════════════════════════

export function contestPanelKb(hasActive: boolean, subOn: boolean): InlineKeyboard {
  const kb = new InlineKeyboard();

  if (hasActive) add(kb, BTN.ADMIN_CONTEST_FINISH, "contest_finish").danger().row();
  else add(kb, BTN.ADMIN_CONTEST_START, "contest_start").success().row();

  add(kb, BTN.ADMIN_CHANNEL, "contest_channel").primary().row();

  // Darvoza holatiga qarab tugma o'zgaradi — admin nima bo'layotganini
  // tugmaning o'zidan ko'radi.
  if (subOn) add(kb, BTN.ADMIN_SUB_OFF, "contest_sub_off").danger().row();
  else add(kb, BTN.ADMIN_SUB_ON, "contest_sub_on").success().row();

  add(kb, BTN.BACK, "admin_panel").primary();
  return kb;
}

export function contestFinishKb(): InlineKeyboard {
  const kb = new InlineKeyboard();
  add(kb, BTN.ADMIN_CONTEST_FINISH, "contest_finish_yes").danger();
  add(kb, BTN.CANCEL, "contest_panel").primary();
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
  add(kb, BTN.PREMIUM_BUY, "premium").success().row();
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
  add(kb, BTN.ADMIN_EXTEND_MIN_DAYS, "admin_extend_min_days").primary();
  add(kb, BTN.ADMIN_EXTEND_FEE, "admin_extend_fee").primary().row();
  add(kb, BTN.ADMIN_TG_ADD, "admin_tg_add").success();
  add(kb, BTN.ADMIN_TG_STATS, "admin_tg_stats").primary().row();
  add(kb, BTN.ADMIN_RENT_STATS, "admin_rent_stats").primary().row();
  add(kb, BTN.ADMIN_CONTEST, "contest_panel").primary().row();
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
