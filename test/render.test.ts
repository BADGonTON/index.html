/**
 * Mini App HAQIQATAN ekranga chiqadimi?
 *
 * Bu test brauzerda sahifani ochadi va nima ko'rinayotganini tekshiradi.
 *
 * Nega kerak: oldingi testlar `/app/app.js` ni TO'G'RIDAN-TO'G'RI so'rab
 * 200 olardi va o'tardi. Lekin brauzer uni HTML ichidagi NISBIY manzildan
 * hisoblaydi: `/app` sahifasidan `app.js` → `/app.js` (ildizda!) → 404.
 * Natijada ilova qora ekran bo'lib qolgan, test esa buni sezmagan.
 *
 * Shu sabab bu yerda sahifa haqiqiy brauzerda ochiladi va "ekranda nimadir
 * bormi?" degan savolga javob beriladi.
 */
import http from "node:http";
import { chromium, Browser } from "playwright";
import { sign } from "@telegram-apps/init-data-node";
import { config } from "../src/config";

const PORT = 18084;
let fails = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "✅" : "❌"} ${label}${extra ? "  " + extra : ""}`);
  if (!cond) fails++;
};

interface Seen {
  splash: boolean; gate: boolean; app: boolean;
  gateTitle: string; failed: string[];
}

async function open(
  browser: Browser,
  opts: { initData: string | null; inIframe: boolean }
): Promise<Seen> {
  const page = await browser.newPage({ viewport: { width: 420, height: 760 }, colorScheme: "dark" });
  const failed: string[] = [];

  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });
  page.on("pageerror", (e) => failed.push(`JS: ${e.message}`));

  if (opts.initData) {
    await page.addInitScript(`
      window.Telegram = { WebApp: {
        initData: ${JSON.stringify(opts.initData)},
        version: "7.10", platform: "tdesktop",
        ready: function(){}, expand: function(){}, close: function(){},
        setHeaderColor: function(){}, disableVerticalSwipes: function(){},
        HapticFeedback: { impactOccurred: function(){}, notificationOccurred: function(){} },
        BackButton: { show: function(){}, hide: function(){}, onClick: function(){} }
      }};`);
  }

  await page.goto(
    opts.inIframe ? `http://127.0.0.1:${PORT}/wrap` : `http://127.0.0.1:${PORT}/app`
  );
  await page.waitForTimeout(2200);

  const target = opts.inIframe
    ? await (await page.locator("#f").elementHandle())!.contentFrame()
    : page.mainFrame();

  // DIQQAT: bu yerda funksiya emas, SATR uzatiladi. tsx/esbuild nomlangan
  // funksiyalarga `__name` yordamchisini qo'shadi, u esa brauzerda mavjud
  // emas va evaluate() yiqiladi.
  const seen = await target!.evaluate(`(() => {
    var vis = function (id) {
      var e = document.getElementById(id);
      if (!e || e.hidden) return false;
      var st = getComputedStyle(e);
      return st.visibility !== "hidden" && st.opacity !== "0";
    };
    var t = document.getElementById("gate-title");
    return {
      splash: vis("splash"), gate: vis("gate"), app: vis("app"),
      gateTitle: t ? t.textContent.trim() : "",
      styled: getComputedStyle(document.body).backgroundColor
    };
  })()`) as any;

  await page.close();
  return { ...seen, failed } as Seen & { styled: string };
}

async function main() {
  const { runMigrations } = await import("../src/db/migrate");
  const { pool, closePool } = await import("../src/db/pool");
  const pricing = await import("../src/services/pricing");
  const users = await import("../src/db/repo/users");
  const { createServer } = await import("../src/web/server");

  await runMigrations();
  await pricing.loadPricing();
  await users.getOrCreateUser(900001, "shahboz");

  const appServer = createServer({} as any);
  const inner = await new Promise<http.Server>((r) => {
    const s = appServer.listen(18085, () => r(s));
  });

  // Telegram Web / Desktop ilovani IFRAME ichida ochadi — shuni taqlid qilamiz.
  // Bir xil origin bo'lishi uchun hammasi bitta proksi orqali o'tadi.
  const wrapper = http.createServer((req, res) => {
    if (req.url === "/wrap") {
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(
        `<!doctype html><body style="margin:0"><iframe id="f" src="/app" ` +
        `style="width:420px;height:760px;border:0"></iframe></body>`
      );
    }
    const proxy = http.request(
      { host: "127.0.0.1", port: 18085, path: req.url, method: req.method, headers: req.headers },
      (r) => { res.writeHead(r.statusCode!, r.headers); r.pipe(res); }
    );
    req.pipe(proxy);
    proxy.on("error", () => { res.writeHead(502); res.end(); });
  });
  await new Promise<void>((r) => wrapper.listen(PORT, () => r()));

  // CHROMIUM_PATH berilmasa Playwright o'zi o'rnatgan brauzerni topadi.
  const executablePath = process.env.CHROMIUM_PATH || undefined;
  const browser = await chromium.launch({ args: ["--no-sandbox"], executablePath });

  const initData = sign({ user: { id: 900001, first_name: "Shahboz" } }, config.botToken, new Date());

  console.log("\n── To'g'ridan-to'g'ri (telefondagi Telegram) ──");
  const direct = await open(browser, { initData, inIframe: false });
  ok("qora ekran EMAS", direct.splash || direct.gate || direct.app);
  ok("ilova ekrani ko'rindi", direct.app, `(splash=${direct.splash} gate=${direct.gate})`);
  ok("404/xato yo'q", direct.failed.length === 0, direct.failed.join(", "));
  ok("CSS qo'llandi", (direct as any).styled !== "rgba(0, 0, 0, 0)", (direct as any).styled);

  console.log("\n── IFRAME ichida (Telegram Web / Desktop) ──");
  const framed = await open(browser, { initData, inIframe: true });
  ok("qora ekran EMAS", framed.splash || framed.gate || framed.app);
  ok("ilova ekrani ko'rindi", framed.app, `(splash=${framed.splash} gate=${framed.gate})`);
  ok("404/xato yo'q", framed.failed.length === 0, framed.failed.join(", "));

  console.log("\n── Telegramdan tashqarida ──");
  const outside = await open(browser, { initData: null, inIframe: false });
  ok("tushuntirish ekrani chiqdi", outside.gate);
  ok("matn to'g'ri", outside.gateTitle.includes("Telegram"), `"${outside.gateTitle}"`);

  await browser.close();
  wrapper.close();
  inner.close();
  await closePool();

  console.log(fails ? `\n❌ ${fails} ta test yiqildi` : "\n🎉 Ilova haqiqatan ekranga chiqmoqda");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
