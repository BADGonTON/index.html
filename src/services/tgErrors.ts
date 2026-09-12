import { GrammyError, HttpError } from "grammy";

/**
 * ---------------------------------------------------------------------------
 *  TELEGRAM XATOLARINI BIR JOYDA TUSHUNISH
 * ---------------------------------------------------------------------------
 *
 * Telegram "foydalanuvchiga yeta olmadim" degan holatni bir necha xil matn
 * bilan qaytaradi. Ular XATO EMAS — botda tuzatadigan hech narsa yo'q va
 * ular log to'ldirib, haqiqiy xatolarni ko'rinmas qilib qo'yadi.
 */

/** Foydalanuvchiga xabar yetib bormasligining sababi. */
export type UnreachableKind = "blocked" | "no_chat" | null;

/**
 * Foydalanuvchiga yeta olmaslik sababini aniqlaydi, boshqa xatoda `null`.
 *
 *   • `blocked` — botni bloklagan yoki akkaunt o'chirilgan
 *   • `no_chat` — botga hech qachon yozmagan (masalan eski bazadan
 *     ko'chirilgan foydalanuvchi). Bu blok EMAS.
 */
export function unreachableKind(err: unknown): UnreachableKind {
  if (!(err instanceof GrammyError)) return null;
  const d = err.description.toLowerCase();
  if (d.includes("blocked by the user")) return "blocked";
  if (d.includes("user is deactivated")) return "blocked";
  if (d.includes("bot was kicked")) return "blocked";
  if (d.includes("can't initiate conversation")) return "no_chat";
  if (d.includes("chat not found")) return "no_chat";
  return null;
}

/** Shu xato "tuzatadigan narsa yo'q" turkumidanmi? */
export function isUnreachable(err: unknown): boolean {
  return unreachableKind(err) !== null;
}

/**
 * Xatoni BIR QATORLIK matnga aylantiradi.
 *
 * Node xato obyektini bosganda butun `ctx` ni ham yozadi — bitta xato
 * yuzlab qator bo'lib ketadi va loglarni o'qib bo'lmaydi. Shu sabab
 * hamma joyda faqat shu funksiya natijasi yoziladi.
 */
export function describeTgError(err: unknown): string {
  if (err instanceof GrammyError) {
    return `${err.method}: ${err.error_code} ${err.description}`;
  }
  if (err instanceof HttpError) {
    return `tarmoq: ${String(err.error)}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
