import type { Api } from "grammy";
import { getSetting, setSetting } from "../db/repo/settings";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  MAJBURIY KANAL OBUNASI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Konkurs vaqtida referal faqat taklif qilingan odam KANALGA A'ZO
 * BO'LGANDAN KEYIN sanaladi. Busiz konkurs soxta akkauntlar bilan
 * to'lib ketardi: havolani bosish uchun hech narsa sarflash kerak emas,
 * kanalga a'zo bo'lish esa hech bo'lmasa bitta tirik akkaunt talab qiladi.
 *
 * Darvoza admin paneldan YOQILADI/O'CHIRILADI. O'chirilgan holatda bot
 * mutlaqo odatdagidek ishlaydi — ya'ni bu tizim mavjud foydalanuvchilarga
 * hech qanday to'siq qo'ymaydi.
 */

let channel = "";
let channelUrl = "";
let required = false;

let apiRef: Api | null = null;

export function bindSubscription(api: Api): void {
  apiRef = api;
}

export async function loadSubscription(): Promise<void> {
  const [ch, url, req] = await Promise.all([
    getSetting("contest_channel"),
    getSetting("contest_channel_url"),
    getSetting("contest_require_sub"),
  ]);
  channel = ch ?? "";
  channelUrl = url ?? "";
  required = req === "1";
}

export function getChannel(): string {
  return channel;
}

export function getChannelUrl(): string {
  // Havola berilmagan bo'lsa @username dan yasaymiz.
  if (channelUrl) return channelUrl;
  if (channel.startsWith("@")) return `https://t.me/${channel.slice(1)}`;
  return "";
}

/** Darvoza yoqilganmi. Kanal sozlanmagan bo'lsa HAR DOIM o'chiq. */
export function isSubscriptionRequired(): boolean {
  return required && channel !== "";
}

export async function setChannel(value: string, url: string): Promise<void> {
  channel = value.trim();
  channelUrl = url.trim();
  await setSetting("contest_channel", channel);
  await setSetting("contest_channel_url", channelUrl);
}

export async function setSubscriptionRequired(value: boolean): Promise<void> {
  required = value;
  await setSetting("contest_require_sub", value ? "1" : "0");
}

/**
 * Odam kanalda bormi?
 *
 * Telegram `getChatMember` ni qaytaradi; bizni faqat holat qiziqtiradi:
 *
 *   creator / administrator / member      — a'zo
 *   restricted (is_member: true)          — a'zo, lekin cheklangan
 *   left / kicked                         — a'zo emas
 *
 * Xato bo'lsa (bot kanalda admin emas, kanal o'chirilgan) `null` qaytadi.
 * Shunda darvoza O'TKAZIB YUBORADI: bizning sozlama xatomiz tufayli
 * foydalanuvchi botdan foydalana olmay qolmasligi kerak.
 */
export async function isMember(userId: number): Promise<boolean | null> {
  if (!apiRef || !channel) return null;

  try {
    const member = await apiRef.getChatMember(channel, userId);
    if (member.status === "restricted") return member.is_member === true;
    return ["creator", "administrator", "member"].includes(member.status);
  } catch (err) {
    const message = (err as Error).message ?? "";
    // "user not found" — odam kanalda yo'q, bu NORMAL javob.
    if (/user not found|PARTICIPANT_ID_INVALID/i.test(message)) return false;

    console.error("❌ Kanal a'zoligini tekshirib bo'lmadi:", message);
    return null;
  }
}
