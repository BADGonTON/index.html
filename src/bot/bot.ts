import { Bot, session } from "grammy";
import { sequentialize } from "@grammyjs/runner";
import { apiThrottler } from "@grammyjs/transformer-throttler";
import { config } from "../config";
import { MyContext, initialSession } from "./session";
import { createPgSessionStorage } from "../db/repo/sessions";
import { bindLogger } from "../services/logger";
import { unreachableKind, describeTgError } from "../services/tgErrors";

import { offerGate, registerOfferHandlers } from "./handlers/offer";
import { maintenanceGate, registerMaintenanceHandlers } from "./handlers/maintenance";
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

  // Telegram limitlari avtomatik hurmat qilinadi — chiqadigan har bir
  // xabar shu navbatdan o'tadi va 429 (Too Many Requests) chiqmaydi.
  //
  // `out.minTime` — BITTA chatga chaqiruvlar orasidagi eng kam vaqt.
  // Kutubxonaning standart qiymati 1000 ms edi, ya'ni sekundiga 1 ta.
  // Tugma bosilganda bot ko'pincha ikki ish qiladi (eski xabarni o'chirish
  // va yangisini chiqarish) — ikkinchisi TO'LIQ bir soniya kutar edi va
  // bot sekin tuyulardi. 250 ms sekundiga 4 ta chaqiruvga yo'l beradi;
  // shaxsiy chatlar uchun Telegram bunga bemalol chidaydi.
  //
  // Umumiy 30 chaqiruv/sekund chegarasi o'zgarmaydi — u Telegramniki.
  bot.api.config.use(apiThrottler({ out: { maxConcurrent: 1, minTime: 250 } }));

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

  // TEXNIK ISHLAR DARVOZASI. Yoqilganda oddiy foydalanuvchi faqat
  // "texnik ishlar bormoqda" javobini oladi; adminlar uchun bot
  // odatdagidek ishlaydi. Ofertadan KEYIN turadi — rozilik bermagan
  // foydalanuvchi baribir ofertani ko'rishi kerak.
  bot.use(maintenanceGate());

  // Tartib muhim: aniq buyruq/callback ushlovchilar oldin,
  // umumiy matn marshrutizatori ENG OXIRIDA.
  registerOfferHandlers(bot);
  registerMaintenanceHandlers(bot);
  registerStartHandlers(bot);
  registerAdminHandlers(bot);
  registerAdminAccountsHandlers(bot);
  registerGiftHandlers(bot);
  registerPaymentHandlers(bot);
  registerStarsHandlers(bot);
  registerPremiumHandlers(bot);
  registerTgProfileHandlers(bot);
  registerTextRouter(bot);

  // Xato BIR QATOR bo'lib yoziladi.
  //
  // Ilgari bu yerda xato obyektining o'zi bosilardi — Node esa u bilan
  // birga butun `ctx` ni ham yozardi: bitta xato yuzlab qator. Loglar
  // o'qib bo'lmas holga kelib, haqiqiy muammolar ko'rinmay qolgandi.
  //
  // Foydalanuvchi botni bloklagani (403) esa umuman xato emas — unda
  // tuzatadigan narsa yo'q, shuning uchun alohida, qisqa qator bilan
  // belgilab o'tiladi.
  bot.catch((err) => {
    const from = err.ctx?.from?.id;
    const who = from ? ` (user ${from})` : "";
    const kind = unreachableKind(err.error);
    if (kind) {
      console.warn(
        `ℹ️  Xabar yetib bormadi${who}: ${
          kind === "blocked" ? "botni bloklagan" : "botga hech qachon yozmagan"
        }`
      );
      return;
    }
    console.error(`❌ Bot xatosi${who}: ${describeTgError(err.error)}`);
  });

  return bot;
}
