import type { Context, SessionFlavor } from "grammy";

/**
 * Foydalanuvchining vaqtinchalik holati (aiogram FSM'ning sodda ekvivalenti).
 *
 *  step — hozir qaysi bosqichda turibdi ("pay:amount", "stars:qty", ...)
 *  data — shu bosqichlar davomida to'plangan ma'lumot
 *
 * Sessiya PostgreSQL'da saqlanadi (src/db/repo/sessions.ts), shuning uchun
 * botni bir nechta processga tarqatsangiz ham bosqichlar yo'qolmaydi.
 */
export interface SessionData {
  /** "eski xabar o'chib, yangisi kiradi" effekti uchun */
  lastBotMessageId?: number;
  /** hozirgi FSM bosqichi (undefined = hech narsa kutilmayapti) */
  step?: string;
  /** bosqichlar davomidagi vaqtinchalik ma'lumot */
  data: Record<string, any>;
}

export type MyContext = Context & SessionFlavor<SessionData>;

export function initialSession(): SessionData {
  return { data: {} };
}
