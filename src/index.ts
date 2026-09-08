import { run, RunnerHandle } from "@grammyjs/runner";
import type { Server } from "node:http";
import { config, validateConfig, miniAppUrl } from "./config";
import { runMigrations } from "./db/migrate";
import { closePool, pingDatabase } from "./db/pool";
import { createBot } from "./bot/bot";
import { createServer } from "./web/server";
import { loadStarPrice } from "./services/starPrice";
import { loadPricing } from "./services/pricing";
import { startCatalogRefresher, stopCatalogRefresher } from "./services/catalog";
import { startTxWorker, stopTxWorker, recoverStuckTxs } from "./worker/txWorker";
import { startRentWorker, stopRentWorker } from "./worker/rentWorker";
import { startSweeper, stopSweeper } from "./worker/sweeper";
import { getWalletAddress } from "./services/wallet";
import { reportTelegramChecks, installMenuButton } from "./services/telegramCheck";

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
  await Promise.all([loadStarPrice(), loadPricing()]);
  console.log("✅ Narx sozlamalari yuklandi");

  const bot = createBot();
  await bot.init();
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
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(config.port, () => resolve(s));
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
    console.error("❌ Ushlanmagan Promise xatosi:", reason);
  });
  process.on("uncaughtException", (err) => {
    console.error("❌ Ushlanmagan istisno:", err);
  });
}

main().catch((err) => {
  console.error("\n❌ Ishga tushirishda kritik xato:\n", err);
  process.exit(1);
});
