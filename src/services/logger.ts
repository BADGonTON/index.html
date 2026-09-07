import type { Api } from "grammy";
import { config } from "../config";

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
    await apiRef.sendMessage(config.logChannelId, text, { parse_mode: "HTML" });
  } catch (err) {
    console.error("Log yuborishda xato:", (err as Error).message);
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
    await apiRef.sendMessage(userId, text, { parse_mode: "HTML", ...(extra ?? {}) } as never);
  } catch {
    // Foydalanuvchi botni bloklagan yoki chatni o'chirgan bo'lishi mumkin.
  }
}
