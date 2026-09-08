import { Bot, session } from "grammy";
import { sequentialize } from "@grammyjs/runner";
import { apiThrottler } from "@grammyjs/transformer-throttler";
import { config } from "../config";
import { MyContext, initialSession } from "./session";
import { createPgSessionStorage } from "../db/repo/sessions";
import { bindLogger } from "../services/logger";

import { offerGate, registerOfferHandlers } from "./handlers/offer";
import { registerStartHandlers } from "./handlers/start";
import { registerAdminHandlers } from "./handlers/admin";
import { registerAdminAccountsHandlers } from "./handlers/adminAccounts";
import { registerGiftHandlers } from "./handlers/gifts";
import { registerPaymentHandlers } from "./handlers/payment";
import { registerStarsHandlers } from "./handlers/stars";
import { registerPremiumHandlers } from "./handlers/premium";
import { registerTgProfileHandlers } from "./handlers/tgProfile";
import { registerTextRouter } from "./handlers/textRouter";

export function createBot(): Bot<MyContext> {
  const bot = new Bot<MyContext>(config.botToken);

  // Telegram limitlari (bir chatga ~1 xabar/s, umumiy ~30 xabar/s) avtomatik
  // hurmat qilinadi — chiqadigan har bir xabar shu navbatdan o'tadi va
  // 429 (Too Many Requests) xatosi umuman bo'lmaydi.
  bot.api.config.use(apiThrottler());

  // Turli foydalanuvchilar PARALLEL, bitta foydalanuvchi esa KETMA-KET
  // qayta ishlanadi — FSM bosqichlari aralashib ketmasligi uchun.
  bot.use(sequentialize((ctx) => ctx.from?.id.toString()));

  // Sessiya PostgreSQL'da: shu tufayli botni bir nechta processga/serverga
  // tarqatish mumkin (RAM sessiyasi bunga imkon bermasdi).
  bot.use(
    session({
      initial: initialSession,
      storage: createPgSessionStorage(),
    })
  );

  bindLogger(bot.api);

  // OFERTA DARVOZASI. Rozilik berilmaguncha /start va "Roziman" tugmasidan
  // boshqa hech narsa ishlamaydi — Telegram Stars va akkaunt savdosi uchun
  // bu talab. Barcha ushlovchilardan OLDIN turishi shart.
  bot.use(offerGate());

  // Tartib muhim: aniq buyruq/callback ushlovchilar oldin,
  // umumiy matn marshrutizatori ENG OXIRIDA.
  registerOfferHandlers(bot);
  registerStartHandlers(bot);
  registerAdminHandlers(bot);
  registerAdminAccountsHandlers(bot);
  registerGiftHandlers(bot);
  registerPaymentHandlers(bot);
  registerStarsHandlers(bot);
  registerPremiumHandlers(bot);
  registerTgProfileHandlers(bot);
  registerTextRouter(bot);

  bot.catch((err) => {
    const from = err.ctx?.from?.id;
    console.error(`❌ Bot xatosi${from ? ` (user ${from})` : ""}:`, err.error);
  });

  return bot;
}
