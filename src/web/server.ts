import path from "node:path";
import express, { Express } from "express";
import compression from "compression";
import { webhookCallback } from "grammy";
import type { Bot } from "grammy";
import { config } from "../config";
import { MyContext } from "../bot/session";
import { createApiRouter } from "./routes";
import { pingDatabase } from "../db/pool";
import { getCatalog } from "../services/catalog";

/**
 * Bitta Express serveri uchta vazifani bajaradi:
 *   1. Mini App statik fayllari  (/app)
 *   2. Mini App API              (/api/*)
 *   3. Telegram webhook          (/tg/<secret>)  — BOT_MODE=webhook bo'lsa
 *
 * Shu tufayli alohida hosting, alohida domen yoki CORS sozlash kerak emas.
 */
export function createServer(bot: Bot<MyContext>): Express {
  const app = express();

  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", 1);

  // gzip/brotli — Mini App JS/CSS hajmini ~4 barobar kamaytiradi.
  app.use(compression());

  // ---------------------------------------------------------------------
  //  Telegram webhook (JSON parser'dan OLDIN — grammY o'zi o'qiydi)
  // ---------------------------------------------------------------------
  if (config.botMode === "webhook") {
    app.post(
      `/tg/${config.webhookSecret}`,
      express.json({ limit: "1mb" }),
      webhookCallback(bot, "express", {
        // Telegram 60 soniya kutadi; biz undan oldinroq javob beramiz.
        timeoutMilliseconds: 55_000,
        secretToken: config.webhookSecret,
      })
    );
  }

  app.use(express.json({ limit: "256kb" }));

  // ---------------------------------------------------------------------
  //  Sog'liq tekshiruvi (monitoring / load balancer uchun)
  // ---------------------------------------------------------------------
  app.get("/healthz", async (_req, res) => {
    try {
      await pingDatabase();
      const catalog = getCatalog();
      res.json({
        ok: true,
        uptime_sec: Math.floor(process.uptime()),
        catalog: {
          gifts: catalog.gifts.length,
          collections: catalog.collections.length,
          age_sec: catalog.fetched_at ? Math.floor(Date.now() / 1000) - catalog.fetched_at : null,
          stale: catalog.stale,
        },
      });
    } catch (err) {
      res.status(503).json({ ok: false, error: (err as Error).message });
    }
  });

  // ---------------------------------------------------------------------
  //  API
  // ---------------------------------------------------------------------
  app.use("/api", createApiRouter());

  // ---------------------------------------------------------------------
  //  Mini App (statik)
  // ---------------------------------------------------------------------
  const miniappDir = path.join(__dirname, "..", "..", "miniapp");

  app.use(
    "/app",
    express.static(miniappDir, {
      etag: true,
      lastModified: true,
      setHeaders(res, filePath) {
        if (filePath.endsWith(".html")) {
          // HTML doim tekshiriladi — yangi versiya darhol yetib boradi.
          res.setHeader("Cache-Control", "no-cache");
        } else {
          // CSS/JS/rasm — 1 kun keshlanadi (fayl nomida ?v= versiyasi bor).
          res.setHeader("Cache-Control", "public, max-age=86400");
        }
      },
    })
  );

  // /app dagi har qanday yo'l index.html ni beradi (klient tomonda navigatsiya).
  app.get("/app/*", (_req, res) => {
    res.sendFile(path.join(miniappDir, "index.html"));
  });

  app.get("/", (_req, res) => res.redirect("/app"));

  // ---------------------------------------------------------------------
  //  Xatolar
  // ---------------------------------------------------------------------
  app.use((_req, res) => {
    res.status(404).json({ error: "Topilmadi" });
  });

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("❌ HTTP xatosi:", err.message);
    if (res.headersSent) return;
    res.status(500).json({ error: "Serverda kutilmagan xatolik" });
  });

  return app;
}
