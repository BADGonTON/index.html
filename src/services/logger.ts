import type { Api } from "grammy";
import { config } from "../config";
import { premiumize } from "../bot/emoji";
import { clearTrackedMessage } from "../db/repo/sessions";

/**
 * Chiqadigan matnni tayyorlaydi: har bir oddiy emoji premium emojiga
 * aylanadi (src/bot/emoji.ts). Bot ichidagi `ui.ts` shu ishni menyular
 * uchun qiladi, bu yerda esa fon jarayonlari yuboradigan xabarlar uchun.
 */
function prepare(text: string): string {
  return config.premiumEmoji ? premiumize(text) : text;
}

let apiRef: Api | null = null;

export function bindLogger(api: Api): void {
  apiRef = api;
}

/**
 * LOG_CHANNEL_ID ga xabar yuboradi.
 * Log yuborib bo'lmasligi hech qachon asosiy ishni to'xtatmasligi kerak —
 * shuning uchun barcha xatolar yutiladi.
 */
export async function sendLog(text: string): Promise<void> {
  if (!apiRef || !config.logChannelId) return;
  try {
    await apiRef.sendMessage(config.logChannelId, prepare(text), { parse_mode: "HTML" });
  } catch (err) {
    console.error("Log yuborishda xato:", (err as Error).message);
  }
}

/**
 * FON xabari yuborilgach, sessiyadagi "oxirgi bot xabari" belgisini tozalaydi.
 *
 * Bu funksiyalar sessiyadan tashqarida ishlaydi (to'lov kanali, blokcheyn
 * ishchisi va h.k.), ya'ni sessiyada eslab qolingan xabar endi chatning
 * oxirgisi EMAS. Tozalanmasa, botning keyingi javobi o'sha eski xabarni
 * tahrirlab yozilardi — foydalanuvchi esa ekranning pastida hech narsa
 * ko'rmasdi va bot "javob bermagandek" tuyulardi.
 *
 * Aynan shu sabab "chek tashladim, bot qotdi" degan xato chiqqan edi.
 */
async function invalidateTrackedMessage(userId: number): Promise<void> {
  await clearTrackedMessage(userId).catch(() => {});
}

/** Rasm + izoh yuboradi (izohdagi emoji ham premium bo'ladi). */
export async function notifyUserPhoto(
  userId: number,
  photo: string,
  caption: string
): Promise<void> {
  if (!apiRef) return;
  try {
    await apiRef.sendPhoto(userId, photo, { caption: prepare(caption), parse_mode: "HTML" });
    await invalidateTrackedMessage(userId);
  } catch {
    // Foydalanuvchi botni bloklagan yoki rasm manzili yaroqsiz.
  }
}

/** Foydalanuvchiga xabar yuboradi (bloklagan bo'lsa jim o'tadi). */
export async function notifyUser(
  userId: number,
  text: string,
  extra?: Record<string, unknown>
): Promise<void> {
  if (!apiRef) return;
  try {
    await apiRef.sendMessage(userId, prepare(text), {
      parse_mode: "HTML",
      ...(extra ?? {}),
    } as never);
    await invalidateTrackedMessage(userId);
  } catch {
    // Foydalanuvchi botni bloklagan yoki chatni o'chirgan bo'lishi mumkin.
  }
}
