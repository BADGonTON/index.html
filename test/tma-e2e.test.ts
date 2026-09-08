/**
 * Telegram Mini App uchun uchdan-uchgacha (end-to-end) test.
 *
 * Haqiqiy server, haqiqiy PostgreSQL va Telegram'ning RASMIY imzolash
 * kutubxonasi ishlatiladi — ya'ni "Telegram yuboradigan narsa" bilan bir xil
 * so'rovlar jo'natiladi.
 */
import http from "node:http";
import { sign } from "@telegram-apps/init-data-node";
import { config } from "../src/config";

let fails = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "✅" : "❌"} ${label}${extra ? "  " + extra : ""}`);
  if (!cond) fails++;
};

const PORT = 18081;
const BASE = `http://127.0.0.1:${PORT}`;

interface Res { status: number; body: string; json: any; headers: Record<string, string> }

function call(path: string, opts: { method?: string; initData?: string; body?: unknown } = {}): Promise<Res> {
  return new Promise((resolve, reject) => {
    const payload = opts.body ? JSON.stringify(opts.body) : undefined;
    const req = http.request(
      {
        host: "127.0.0.1", port: PORT, path, method: opts.method ?? "GET",
        headers: {
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
          ...(opts.initData ? { Authorization: `tma ${opts.initData}` } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          let json: any = null;
          try { json = JSON.parse(raw); } catch { /* HTML */ }
          resolve({ status: res.statusCode!, body: raw, json, headers: res.headers as any });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  const { runMigrations } = await import("../src/db/migrate");
  const { pool, closePool } = await import("../src/db/pool");
  const pricing = await import("../src/services/pricing");
  const users = await import("../src/db/repo/users");
  const { createServer } = await import("../src/web/server");

  await runMigrations();
  await pricing.loadPricing();
  await pool.query("TRUNCATE users, rentals, market_collections RESTART IDENTITY CASCADE");

  const app = createServer({} as any);
  const srv = await new Promise<http.Server>((r) => { const s = app.listen(PORT, () => r(s)); });

  const U = 900001;
  await users.getOrCreateUser(U, "shahboz");
  await users.creditBalance(U, 1_000_000, "admin");

  const initData = sign(
    { user: { id: U, first_name: "Shahboz", username: "shahboz" }, chat_type: "private" },
    config.botToken,
    new Date()
  );

  console.log("\n── Mini App sahifasi ──");

  // Telegram AYNAN shu manzilni ochadi — oxirida "/" YO'Q
  const appNoSlash = await call("/app");
  ok("GET /app to'g'ridan-to'g'ri 200 (yo'naltirishsiz)", appNoSlash.status === 200,
     `(${appNoSlash.status})`);
  ok("HTML qaytdi", appNoSlash.body.includes("<!DOCTYPE html>"));
  ok("Telegram SDK ulangan", appNoSlash.body.includes("telegram-web-app.js"));
  ok("ikonka sprite ichida", appNoSlash.body.includes('id="i-tab-market"'));

  ok("GET /app/ ham ishlaydi", (await call("/app/")).status === 200);
  ok("CSS beriladi", (await call("/app/styles.css?v=3")).status === 200);
  ok("JS beriladi", (await call("/app/app.js?v=3")).status === 200);

  // Telegram Web/Desktop ilovani IFRAME'da ochadi
  ok("X-Frame-Options qo'yilmagan", !appNoSlash.headers["x-frame-options"],
     appNoSlash.headers["x-frame-options"] ?? "");
  ok("iframe'ni to'suvchi CSP yo'q",
     !/frame-ancestors/i.test(appNoSlash.headers["content-security-policy"] ?? ""));
  ok("HTML keshlanmaydi (yangi versiya darhol yetadi)",
     (appNoSlash.headers["cache-control"] ?? "").includes("no-cache"));

  console.log("\n── Avtorizatsiya ──");

  ok("imzosiz → 401 'missing'", (await call("/api/bootstrap")).json?.reason === "missing");

  const bad = await call("/api/bootstrap", { initData: initData.replace(/hash=.*/, "hash=00") });
  ok("buzilgan imzo → 401 'invalid'", bad.status === 401 && bad.json?.reason === "invalid");

  const expired = sign({ user: { id: U, first_name: "X" } }, config.botToken,
                       new Date(Date.now() - 30 * 24 * 3600 * 1000));
  ok("eskirgan → 401 'expired'", (await call("/api/bootstrap", { initData: expired })).json?.reason === "expired");

  console.log("\n── Haqiqiy oqim ──");

  const boot = await call("/api/bootstrap", { initData });
  ok("bootstrap 200", boot.status === 200, `(${boot.status})`);
  ok("foydalanuvchi tanildi", boot.json?.user?.id === U);
  ok("balans keldi", boot.json?.balance_uzs === 1_000_000);
  ok("giftlar bootstrap'da YO'Q (yengil)", boot.json?.catalog?.gifts === undefined);
  ok("bootstrap < 40 KB", Buffer.byteLength(boot.body) < 40_000,
     `(${(Buffer.byteLength(boot.body) / 1024).toFixed(1)} KB)`);

  const gifts = await call("/api/gifts?limit=60", { initData });
  ok("giftlar sahifasi 200", gifts.status === 200);

  const rentals = await call("/api/rentals", { initData });
  ok("ijaralar ro'yxati 200", rentals.status === 200 && Array.isArray(rentals.json?.rentals));

  // Boshqa foydalanuvchi nomidan imzo — o'z ma'lumotini olishi kerak, begonani emas
  const otherInit = sign({ user: { id: 900002, first_name: "Boshqa" } }, config.botToken, new Date());
  const otherBoot = await call("/api/bootstrap", { initData: otherInit });
  ok("boshqa foydalanuvchi o'z hisobini oldi",
     otherBoot.json?.user?.id === 900002 && otherBoot.json?.balance_uzs === 0);

  console.log("\n── Rate limit ──");
  const burst = await Promise.all(
    Array.from({ length: 12 }, () => call("/api/balance", { initData }))
  );
  ok("oddiy yuk bloklanmaydi", burst.every((r) => r.status === 200));

  console.log("\n── Sog'liq ──");
  const health = await call("/healthz");
  ok("/healthz 200", health.status === 200 && health.json?.ok === true);

  srv.close();
  await closePool();
  console.log(fails ? `\n❌ ${fails} ta test yiqildi` : "\n🎉 Barcha TMA testlari o'tdi");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
