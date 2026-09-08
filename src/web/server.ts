import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import express, { Express } from "express";
import compression from "compression";
import { webhookCallback } from "grammy";
import type { Bot } from "grammy";
import { config } from "../config";
import { MyContext } from "../bot/session";
import { createApiRouter } from "./routes";
import { pingDatabase } from "../db/pool";
import { catalogStats } from "../services/catalog";

/**
 * Kiruvchi HTTP so'rovlar jurnali.
 *
 * Busiz "serverga so'rov kelyaptimi?" degan savolga javob yo'q edi — bot
 * hech narsa yozmasdi. Endi har bir so'rov ko'rinadi:
 *
 *   → GET  /app                200  8ms   ip=213.230.x.x
 *   → GET  /api/bootstrap      200 41ms   ip=213.230.x.x user=1905881970
 *   → POST /tg/***             200  6ms   ip=91.108.x.x   (Telegram webhook)
 *
 * Foydalanuvchi ID'si `initData` dan olinadi (imzo TEKSHIRILMAYDI — bu faqat
 * jurnal uchun; haqiqiy tekshiruv `requireTelegramAuth` da bo'ladi).
 *
 * Webhook maxfiy kaliti jurnalda HECH QACHON ko'rinmaydi.
 */
function requestLogger() {
  const secretPath = config.webhookSecret ? `/tg/${config.webhookSecret}` : null;

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const startedAt = process.hrtime.bigint();

    res.on("finish", () => {
      const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;

      // Maxfiy kalitni yashiramiz
      let url = req.originalUrl;
      if (secretPath && url.startsWith(secretPath)) url = "/tg/***";

      const parts = [
        `→ ${req.method.padEnd(4)} ${url.slice(0, 80).padEnd(28)}`,
        String(res.statusCode),
        `${ms.toFixed(0)}ms`.padStart(6),
      ];

      const ip = req.ip ?? req.socket.remoteAddress;
      if (ip) parts.push(`ip=${ip}`);

      const userId = peekUserId(req.header("Authorization"));
      if (userId) parts.push(`user=${userId}`);

      console.log(parts.join(" "));
    });

    next();
  };
}

/**
 * index.html ni o'qib, `__V__` o'rniga statik fayllar mazmunining hash'ini
 * qo'yadi. Natija xotirada saqlanadi.
 */
function buildIndexHtml(dir: string): string {
  const html = fs.readFileSync(path.join(dir, "index.html"), "utf-8");

  const hash = crypto.createHash("sha1");
  for (const file of ["app.js", "styles.css"]) {
    hash.update(fs.readFileSync(path.join(dir, file)));
  }
  const version = hash.digest("hex").slice(0, 10);

  console.log(`📦 Mini App versiyasi: ${version}`);
  return html.replace(/__V__/g, version);
}

/** initData dan foydalanuvchi ID'sini oladi — FAQAT jurnal uchun. */
function peekUserId(authHeader: string | undefined): number | null {
  if (!authHeader?.startsWith("tma ")) return null;
  try {
    const raw = new URLSearchParams(authHeader.slice(4)).get("user");
    if (!raw) return null;
    const id = JSON.parse(raw)?.id;
    return typeof id === "number" ? id : null;
  } catch {
    return null;
  }
}

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

  // Kiruvchi so'rovlar jurnali — eng oldin, shunda HAMMA so'rov ko'rinadi
  // (webhook ham, statik fayllar ham).
  if (config.logRequests) app.use(requestLogger());

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
      res.json({
        ok: true,
        uptime_sec: Math.floor(process.uptime()),
        catalog: catalogStats(),
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

  // index.html bir marta o'qiladi va `__V__` o'rniga fayllar MAZMUNIDAN
  // olingan hash qo'yiladi.
  //
  // Nega: avval versiya qo'lda (`?v=3`) yozilardi. app.js o'zgarib, raqam
  // o'zgarmasa — brauzerda 24 soat eski fayl qolib ketardi va yangi HTML
  // eski JS bilan juftlashib, ilova qora ekran bo'lib qolardi. Endi mazmun
  // o'zgarsa manzil ham o'zgaradi, ya'ni bunday juftlik umuman bo'lmaydi.
  const indexHtml = buildIndexHtml(miniappDir);

  app.use(
    "/app",
    express.static(miniappDir, {
      etag: true,
      lastModified: true,
      // `/app` (oxirida "/" YO'Q) so'roviga 301 yo'naltirish BERMASIN.
      // Telegram ilovani aynan shu manzil bilan ochadi, ya'ni har bir
      // ochilish ortiqcha bir aylanishga aylanardi. Yo'naltirish o'rniga
      // pastdagi marshrut index.html ni to'g'ridan-to'g'ri beradi.
      redirect: false,
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

  // Telegram ilovani AYNAN `/app` manzili bilan ochadi (oxirida "/" yo'q).
  // express.static bunday so'rovni `/app/` ga 301 bilan yo'naltiradi — ya'ni
  // har bir ochilishda ortiqcha bir aylanish. Shuning uchun uni to'g'ridan-to'g'ri
  // beramiz.
  app.get(["/app", "/app/*"], (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.type("html").send(indexHtml);
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
