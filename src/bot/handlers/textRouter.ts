import { Bot } from "grammy";
import { MyContext } from "../session";
import { STEP } from "../steps";
import { isAdmin } from "../../config";
import { deleteUserMessage } from "../ui";

import { handlePayAmountText } from "./payment";
import { handleStarsQtyText, handleStarsUsernameText } from "./stars";
import { handlePremiumUsernameText, handlePremiumMonthsText } from "./premium";
import {
  handleAdminAddBalanceText,
  handleAdminSubBalanceText,
  handleAdminBanText,
  handleAdminSetPriceText,
  handleAdminSetTonRateText,
  handleAdminSetServiceFeeText,
  handleAdminSetExtendMinDaysText,
  handleAdminSetExtendFeeText,
  handleAdminBroadcastWaitText,
  handleAdminGiftAddIdText,
  handleAdminGiftAddStarsText,
  handleAdminGiftAddPremiumIdText,
} from "./admin";
import {
  handleAdminTgPhoneText,
  handleAdminTgPriceText,
  handleAdminTgTwoFaText,
  handleAdminTgCodeText,
} from "./adminAccounts";

/**
 * Oddiy matn xabar kelganda `ctx.session.step` ga qarab kerakli bosqich
 * funksiyasini chaqiradi.
 *
 * Yangi bosqichli funksiya qo'shsangiz — steps.ts ga nom, handler faylga
 * funksiya, shu jadvalga bitta qator. Boshqa hech narsa o'zgarmaydi.
 */
type StepHandler = (bot: Bot<MyContext>, ctx: MyContext) => Promise<void>;

const ROUTES: Record<string, StepHandler> = {
  [STEP.PAY_AMOUNT]: (bot, ctx) => handlePayAmountText(bot, ctx),

  [STEP.STARS_QTY]: (_bot, ctx) => handleStarsQtyText(ctx),
  [STEP.STARS_USERNAME]: (bot, ctx) => handleStarsUsernameText(bot, ctx),

  [STEP.PREMIUM_USERNAME]: (_bot, ctx) => handlePremiumUsernameText(ctx),
  [STEP.PREMIUM_MONTHS]: (bot, ctx) => handlePremiumMonthsText(bot, ctx),

  [STEP.ADMIN_ADD_BALANCE]: (_bot, ctx) => handleAdminAddBalanceText(ctx),
  [STEP.ADMIN_SUB_BALANCE]: (_bot, ctx) => handleAdminSubBalanceText(ctx),
  [STEP.ADMIN_BAN_USER]: (_bot, ctx) => handleAdminBanText(ctx),
  [STEP.ADMIN_SET_PRICE]: (_bot, ctx) => handleAdminSetPriceText(ctx),
  [STEP.ADMIN_SET_TON_RATE]: (_bot, ctx) => handleAdminSetTonRateText(ctx),
  [STEP.ADMIN_SET_SERVICE_FEE]: (_bot, ctx) => handleAdminSetServiceFeeText(ctx),
  [STEP.ADMIN_SET_EXTEND_MIN_DAYS]: (_bot, ctx) => handleAdminSetExtendMinDaysText(ctx),
  [STEP.ADMIN_SET_EXTEND_FEE]: (_bot, ctx) => handleAdminSetExtendFeeText(ctx),
  [STEP.ADMIN_BROADCAST_WAIT]: (_bot, ctx) => handleAdminBroadcastWaitText(ctx),

  [STEP.ADMIN_GIFT_ADD_ID]: (_bot, ctx) => handleAdminGiftAddIdText(ctx),
  [STEP.ADMIN_GIFT_ADD_STARS]: (_bot, ctx) => handleAdminGiftAddStarsText(ctx),
  [STEP.ADMIN_GIFT_ADD_PREMIUM_ID]: (_bot, ctx) => handleAdminGiftAddPremiumIdText(ctx),

  [STEP.ADMIN_TG_ADD_PHONE]: (_bot, ctx) => handleAdminTgPhoneText(ctx),
  [STEP.ADMIN_TG_ADD_PRICE]: (_bot, ctx) => handleAdminTgPriceText(ctx),
  [STEP.ADMIN_TG_ADD_TWOFA]: (_bot, ctx) => handleAdminTgTwoFaText(ctx),
  [STEP.ADMIN_TG_ADD_CODE]: (_bot, ctx) => handleAdminTgCodeText(ctx),
};

/**
 * Foydalanuvchi xabari O'CHIRILMAYDIGAN bosqichlar.
 *
 * Broadcast xabarni `copyMessage` bilan ko'chiradi — ya'ni ASL xabar
 * chatda turishi SHART. Uni o'chirib yuborsak, "Yuborish" bosilganda
 * Telegram har bir foydalanuvchi uchun
 * `400: message to copy not found` qaytaradi va xabar hech kimga
 * yetib bormaydi.
 */
const KEEP_USER_MESSAGE = new Set<string>([STEP.ADMIN_BROADCAST_WAIT]);

export function registerTextRouter(bot: Bot<MyContext>): void {
  bot.on("message:text", async (ctx) => {
    const step = ctx.session.step;
    if (!step) return; // Hech narsa kutilmayapti

    // Admin bosqichlari uchun qo'shimcha himoya: agar foydalanuvchi admin
    // ro'yxatidan chiqarilgan bo'lsa, yarim qolgan bosqich ishlamaydi.
    if (step.startsWith("admin:") && !isAdmin(ctx.from!.id)) {
      ctx.session.step = undefined;
      ctx.session.data = {};
      return;
    }

    const handler = ROUTES[step];
    if (!handler) return;

    // Foydalanuvchi yozgan qiymat (summa, username, kod) chatda qolmasin —
    // shunda ekranda faqat BITTA, tahrirlanadigan bot xabari turadi.
    // O'chirish bilan javob berish PARALLEL ketadi: kutish yo'q.
    if (KEEP_USER_MESSAGE.has(step)) {
      await handler(bot, ctx);
      return;
    }
    await Promise.all([deleteUserMessage(ctx), handler(bot, ctx)]);
  });
}
