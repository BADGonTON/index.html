import { Bot } from "grammy";
import { MyContext } from "../session";
import { renderMenu, sendFresh, deleteLastBotMessage } from "../ui";
import { isAdmin } from "../../config";
import { isMaintenance, toggleMaintenance } from "../../services/maintenance";
import { MAINTENANCE_MESSAGE, MAINTENANCE_ON, MAINTENANCE_OFF } from "../texts";
import { supportKb, adminKb } from "../keyboards";

/**
 * Texnik ishlar darvozasi.
 *
 * Rejim yoqilganda oddiy foydalanuvchi nima bosmasin — bitta javob oladi:
 * "texnik ishlar bormoqda". Adminlar uchun bot odatdagidek ishlaydi,
 * shuning uchun tuzatishni shu yerning o'zida tekshirib ko'rish mumkin.
 *
 * Oferta darvozasidan KEYIN turadi: rozilik bermagan foydalanuvchi
 * baribir ofertani ko'rishi kerak.
 */
export function maintenanceGate() {
  return async (ctx: MyContext, next: () => Promise<void>): Promise<void> => {
    if (!ctx.from || ctx.from.is_bot) return next();
    if (isAdmin(ctx.from.id)) return next();
    if (!(await isMaintenance())) return next();

    // Tugma bosilgan bo'lsa — "yuklanmoqda" belgisi osilib qolmasin.
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: "Texnik ishlar bormoqda", show_alert: true });
    }

    // Bosqichda qolib ketmasin: rejim o'chgach toza boshlashi kerak.
    ctx.session.step = undefined;
    ctx.session.data = {};

    await deleteLastBotMessage(ctx);
    await sendFresh(ctx, MAINTENANCE_MESSAGE, supportKb());
  };
}

export function registerMaintenanceHandlers(bot: Bot<MyContext>): void {
  bot.callbackQuery("admin_maintenance", async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
      await ctx.answerCallbackQuery();
      return;
    }

    const on = await toggleMaintenance();
    await renderMenu(ctx, on ? MAINTENANCE_ON : MAINTENANCE_OFF, adminKb(on));
    await ctx.answerCallbackQuery({
      text: on ? "Texnik ishlar rejimi yoqildi" : "Bot yana ochiq",
    });
  });
}
