import { run, RunnerHandle } from "@grammyjs/runner";
import type { Server } from "node:http";
import { config, validateConfig, miniAppUrl, setBotUsername } from "./config";
import { runMigrations } from "./db/migrate";
import { closePool, pingDatabase } from "./db/pool";
import { createBot } from "./bot/bot";
import { createServer } from "./web/server";
import { loadStarPrice } from "./services/starPrice";
import { loadPricing } from "./services/pricing";
import { loadMaintenance } from "./services/maintenance";
import { startCatalogRefresher, stopCatalogRefresher } from "./services/catalog";
import { startTxWorker, stopTxWorker, recoverStuckTxs } from "./worker/txWorker";
import { startRentWorker, stopRentWorker } from "./worker/rentWorker";
import { startSweeper, stopSweeper } from "./worker/sweeper";
import { getWalletAddress } from "./services/wallet";
import { reportTelegramChecks, installMenuButton } from "./services/telegramCheck";
import { isUnreachable, describeTgError } from "./services/tgErrors";

/**
 * Butun platformaning kirish nuqtasi.
 *
 * Bitta process ichida:
 *   • Telegram bot (webhook yoki polling)
 *   • Mini App + API serveri
 *   • Uchta fon ishchisi (Stars/Premium, Gift Arenda, tozalash)
 *   • Katalog keshini yangilovchi
 *
 * Yuk oshsa: BOT_MODE=webhook qilib, bir nechta nusxani nginx orqali
 * balanslash kifoya — sessiya, navbat va qulflar allaqachon bazada.
 */
async function main(): Promise<void> {
  console.log("\n🚀 HozirOL platformasi ishga tushmoqda...\n");

  validateConfig();

  await pingDatabase();
  console.log("✅ PostgreSQL ulanishi tayyor");

  await runMigrations();
  await Promise.all([loadStarPrice(), loadPricing(), loadMaintenance()]);
  console.log("✅ Narx sozlamalari yuklandi");

  const bot = createBot();
  await bot.init();
  setBotUsername(bot.botInfo.username);
  console.log(`✅ Bot: @${bot.botInfo.username}`);

  try {
    console.log(`💎 TON hamyon: ${await getWalletAddress()}`);
  } catch (err) {
    console.warn("⚠️  TON hamyonini o'qib bo'lmadi:", (err as Error).message);
  }

  // Katalogni bazadan tiklab, fon yangilashini boshlaymiz.
  // Mini App shu daqiqadan boshlab to'liq tez ishlaydi.
  await startCatalogRefresher();

  await recoverStuckTxs();
  startTxWorker(bot.api).catch((err) => console.error("❌ Stars worker to'xtadi:", err));
  startRentWorker().catch((err) => console.error("❌ Arenda worker to'xtadi:", err));
  startSweeper();

  const app = createServer(bot);
  const server: Server = await new Promise((resolve, reject) => {
    const s = app.listen(config.port, () => resolve(s));
    // Port band bo'lsa `listen` xato QAYTARMAYDI — u 'error' hodisasini
    // chiqaradi. Uni ushlamasak Node xom stek bilan yiqilardi va sabab
    // ko'rinmasdi.
    s.once("error", reject);
  });
  console.log(`✅ Server ${config.port}-portda`);
  if (config.publicUrl) console.log(`✅ Mini App: ${miniAppUrl()}`);

  await bot.api.setMyCommands([
    { command: "start", description: "Botni ishga tushirish" },
  ]);

  // Xabar maydoni yonidagi doimiy "Gift Arenda" tugmasi — ko'pchilik
  // Mini App'ni aynan shu yerdan qidiradi.
  await installMenuButton(bot.api);

  let runner: RunnerHandle | null = null;

  if (config.botMode === "webhook") {
    const webhookUrl = `${config.publicUrl}/tg/${config.webhookSecret}`;
    await bot.api.setWebhook(webhookUrl, {
      secret_token: config.webhookSecret,
      drop_pending_updates: false,
      allowed_updates: [
        "message",
        "callback_query",
        "channel_post",
        "pre_checkout_query",
        "my_chat_member",
      ],
    });
    console.log(`✅ Webhook o'rnatildi: ${config.publicUrl}/tg/***`);
  } else {
    // Polling: webhook qoldiq bo'lsa olib tashlaymiz, aks holda Telegram
    // yangilanish yubormaydi.
    await bot.api.deleteWebhook({ drop_pending_updates: false }).catch(() => {});
    // run() yangilanishlarni PARALLEL qayta ishlaydi (oddiy bot.start() esa
    // bittalab, navbat bilan) — bu sezilarli farq beradi.
    runner = run(bot);
    console.log("✅ Long polling ishga tushdi (parallel)");
  }

  // Telegram bilan bog'lanishni tekshiramiz: webhook, menyu tugmasi va
  // Mini App sahifasining TASHQARIDAN ochilishi. Muammolar shu yerda
  // aniq ko'rinadi — keyinroq "nega ochilmayapti?" deb qidirmaslik uchun.
  await reportTelegramChecks(bot.api).catch((err) =>
    console.warn("Diagnostikani bajarib bo'lmadi:", err.message)
  );

  console.log("🎉 Hammasi tayyor!\n");

  // ---------------------------------------------------------------------
  //  To'g'ri o'chirish (graceful shutdown)
  // ---------------------------------------------------------------------
  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n🛑 ${signal} — to'xtatilmoqda...`);

    stopTxWorker();
    stopRentWorker();
    stopSweeper();
    stopCatalogRefresher();

    if (runner?.isRunning()) await runner.stop().catch(() => {});
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closePool().catch(() => {});

    console.log("👋 To'xtatildi");
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  // Ushlanmagan xatolar butun processni yiqitmasligi kerak — lekin ular
  // albatta ko'rinishi shart, aks holda muammo sezilmay qoladi.
  process.on("unhandledRejection", (reason) => {
    // Foydalanuvchi botni bloklagani (403) xato emas — bir qatorlik
    // eslatma yetarli. Qolganlari ham BIR QATOR bo'lib yoziladi: xato
    // obyektini butunlay bosish loglarni yuzlab qator bilan to'ldirib,
    // haqiqiy muammolarni ko'rinmas qilib qo'yardi.
    if (isUnreachable(reason)) {
      console.warn("ℹ️  Xabar yetib bormadi:", describeTgError(reason));
      return;
    }
    console.error("❌ Ushlanmagan Promise xatosi:", describeTgError(reason));
  });
  // Ushlanmagan istisnodan keyin process qanday holatda qolganini bilib
  // bo'lmaydi: ulanish ochiq qolgan, navbat yarim bajarilgan bo'lishi
  // mumkin. Pul bilan ishlaydigan botda "yarim tirik" holatda davom etish
  // yiqilishdan XAVFLIROQ — chunki nazoratchi (systemd/PM2) buni sezmaydi
  // va qayta ishga tushirmaydi.
  //
  // Shuning uchun: xatoni yozamiz va CHIQAMIZ. Nazoratchi bir necha
  // soniyada toza holatda qayta ishga tushiradi.
  process.on("uncaughtException", (err) => {
    console.error("❌ Ushlanmagan istisno — qayta ishga tushirish kerak:", err);
    // Log yozilib ulgursin.
    setTimeout(() => process.exit(1), 500);
  });
}

main().catch((err) => {
  // Eng ko'p uchraydigan xato — port band. Sabab odatda oddiy: botning
  // eski nusxasi hali ishlab turibdi. Xom stek o'rniga nima qilish
  // kerakligini aytamiz.
  if ((err as NodeJS.ErrnoException)?.code === "EADDRINUSE") {
    console.error(
      `\n❌ ${config.port}-port BAND — botning boshqa nusxasi ishlab turibdi.\n\n` +
        `Kim band qilganini ko'rish:\n` +
        `    sudo lsof -i :${config.port}\n\n` +
        `Agar bot xizmat sifatida ishlayotgan bo'lsa (to'g'ri yo'l):\n` +
        `    sudo systemctl restart hozirol\n\n` +
        `Qo'lda ishga tushirilgan nusxani to'xtatish:\n` +
        `    sudo fuser -k ${config.port}/tcp\n\n` +
        `Batafsil: DEPLOY.md\n`
    );
    process.exit(1);
  }

  console.error("\n❌ Ishga tushirishda kritik xato:\n", err);
  process.exit(1);
});
