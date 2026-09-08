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

async function launchBrowser(): Promise<Browser> {
  const candidates = [process.env.CHROMIUM_PATH, undefined, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"];
  let lastError: unknown;
  for (const executablePath of candidates) {
    if (executablePath === "") continue;
    try {
      return await chromium.launch({ args: ["--no-sandbox"], executablePath });
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
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
  // To'plam tugmasida YAKUNIY narx chiqishi uchun balans yetarli bo'lsin.
  await users.creditBalance(900001, 500_000, "admin", "test");

  const appServer = createServer({} as any);
  const inner = await new Promise<http.Server>((r) => {
    const s = appServer.listen(18085, () => r(s));
  });

  // Telegram Web / Desktop ilovani IFRAME ichida ochadi — shuni taqlid qilamiz.
  // Bir xil origin bo'lishi uchun hammasi bitta proksi orqali o'tadi.
  // To'plamlar ro'yxati UI TESTI uchun shu yerdan beriladi: serverdagi
  // katalog bo'sh (Marketapp yo'q), lekin bizga aynan MINI APP to'plam
  // kartochkalarini, o'lcham tugmalarini va narxni to'g'ri chizishi kerak.
  //
  // Rasmlar TARMOQQA chiqmaydi: data: URI ishlatiladi, shunda test
  // internetga bog'liq bo'lmaydi va konsol xatolari faqat HAQIQIY
  // xatolarni bildiradi.
  const PIXEL =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

  const bundleFixture = {
    id: "b1",
    kind: "backdrop",
    kind_label: "Bir xil fon",
    value: "Neon Blue",
    collection_name: "Pool Floats",
    collection_address: "EQCol0",
    available: 12,
    sizes: [3, 6, 9, 12],
    min_days: 7,
    max_days: 90,
    from_per_day_uzs: 1833,
    prices: [
      { size: 3, per_day_uzs: 5499, total_uzs: 48943 },
      { size: 6, per_day_uzs: 11000, total_uzs: 97900 },
      { size: 9, per_day_uzs: 16500, total_uzs: 146850 },
      { size: 12, per_day_uzs: 22000, total_uzs: 195800 },
    ],
    preview: [1, 2, 3, 4].map((i) => ({ nft_name: `Pool Float #${i}`, image_url: PIXEL })),
    gifts: Array.from({ length: 12 }, (_, i) => ({
      nft_address: `EQ${i}`,
      nft_name: `Pool Float #${i + 1}`,
      image_url: PIXEL,
      max_days: 90,
    })),
  };

  const wrapper = http.createServer((req, res) => {
    if (req.url?.startsWith("/api/bundles")) {
      const one = req.url.includes("/bundles/");
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(
        one
          ? { bundle: bundleFixture }
          : { version: "v1", total: 1, offset: 0, has_more: false, items: [bundleFixture] }
      ));
    }
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

  // Avval Playwright o'zi o'rnatgan brauzerni sinaymiz; topilmasa —
  // muhitdagi tayyor Chromium'ga tushamiz. Shu tufayli test CI'da ham,
  // lokal muhitda ham qo'shimcha sozlamasiz ishlaydi.
  const browser = await launchBrowser();

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

  console.log("\n── To'plamlar ekrani ──");
  {
    const page = await browser.newPage({ viewport: { width: 420, height: 760 }, colorScheme: "dark" });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    // Konsol xatosini URL bilan yozamiz — aks holda "resource failed"
    // degan foydasiz matn qoladi.
    // telegram.org bu test muhitida yopiq — SDK o'rniga yuqoridagi stub
    // ishlaydi, shuning uchun uni xato deb sanamaymiz.
    page.on("requestfailed", (r) => {
      if (!r.url().startsWith("https://telegram.org/")) errors.push(`yuklanmadi: ${r.url()}`);
    });
    page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text()); });

    await page.addInitScript(`
      window.Telegram = { WebApp: {
        initData: ${JSON.stringify(initData)},
        version: "7.10", platform: "tdesktop",
        ready: function(){}, expand: function(){}, close: function(){},
        setHeaderColor: function(){}, disableVerticalSwipes: function(){},
        openTelegramLink: function(u){ window.__opened = u; },
        HapticFeedback: { impactOccurred: function(){}, notificationOccurred: function(){} },
        BackButton: { show: function(){}, hide: function(){}, onClick: function(){} }
      }};`);

    await page.goto(`http://127.0.0.1:${PORT}/app`);
    await page.waitForTimeout(1600);

    await page.click('[data-tab="bundles"]');
    await page.waitForTimeout(500);

    const card = await page.evaluate(`(() => {
      var c = document.querySelector(".bcard");
      if (!c) return null;
      return {
        name: (c.querySelector(".bcard-name") || {}).textContent,
        kind: (c.querySelector(".bcard-kind") || {}).textContent.trim(),
        price: (c.querySelector(".bcard-price") || {}).textContent.trim(),
        cells: c.querySelectorAll(".bcard-cell").length
      };
    })()`) as any;

    ok("to'plam kartochkasi chizildi", Boolean(card), card ? `${card.name} · ${card.price}` : "yo'q");
    ok("fon nomi ko'rindi", card?.kind?.includes("Bir xil fon"), card?.kind ?? "");
    ok("kartochkada 4 ta rasm katagi bor", card?.cells === 4, String(card?.cells));

    await page.click(".bcard");
    await page.waitForTimeout(500);

    const detail = await page.evaluate(`(() => {
      var s = document.querySelector('[data-screen="bundle"]');
      return {
        active: s && s.classList.contains("is-active"),
        sizes: Array.prototype.map.call(document.querySelectorAll("#bundle-sizes .size-chip"), function (b) { return b.textContent; }),
        picked: (document.querySelector("#bundle-sizes .size-chip.is-active") || {}).textContent,
        gifts: document.querySelectorAll("#bundle-grid .bgift").length,
        lit: document.querySelectorAll("#bundle-grid .bgift.is-in").length,
        total: (document.getElementById("bundle-total") || {}).textContent,
        days: (document.getElementById("bundle-days-value") || {}).textContent,
        pay: (document.getElementById("bundle-pay") || {}).textContent
      };
    })()`) as any;

    ok("to'plam detali ochildi", detail.active);
    ok("o'lchamlar 3/6/9/12", detail.sizes.join(",") === "3 ta,6 ta,9 ta,12 ta", detail.sizes.join(","));
    ok("boshlang'ich muddat 7 kun", detail.days === "7", detail.days);
    ok("12 ta gift chizildi", detail.gifts === 12, String(detail.gifts));
    ok("faqat tanlangan 3 tasi yorqin", detail.lit === 3, String(detail.lit));
    ok("to'plam narxi ko'rsatildi", /48\s?943/.test(detail.total.replace(/\u00a0/g, " ")), detail.total);
    ok("tugmada YAKUNIY narx bor", /48\s?943/.test(detail.pay.replace(/\u00a0/g, " ")), detail.pay);

    // 6 ta ni tanlaymiz — narx ham, yorqin giftlar ham o'zgarishi kerak
    await page.click("#bundle-sizes .size-chip:nth-child(2)");
    await page.waitForTimeout(250);
    const six = await page.evaluate(`(() => ({
      lit: document.querySelectorAll("#bundle-grid .bgift.is-in").length,
      total: (document.getElementById("bundle-total") || {}).textContent
    }))()`) as any;
    ok("6 ta tanlanganda 6 tasi yorqin", six.lit === 6, String(six.lit));
    ok("6 ta narxi yangilandi", /97\s?900/.test(six.total.replace(/\u00a0/g, " ")), six.total);

    // Slayderni 14 kunga surganda narx server formulasi bo'yicha o'sadi:
    // (11000 × 14 + 2000 × 6) × 1.1 = 182 600
    await page.evaluate(`(() => {
      var s = document.getElementById("bundle-slider");
      s.value = "14";
      s.dispatchEvent(new Event("input", { bubbles: true }));
    })()`);
    await page.waitForTimeout(200);
    const long = await page.evaluate(`(() => (document.getElementById("bundle-total") || {}).textContent)()`) as string;
    ok("14 kunlik narx to'g'ri hisoblandi", /182\s?600/.test(long.replace(/\u00a0/g, " ")), long);

    // Gift ustiga bosilganda Telegramdagi NFT sahifasi ochilishi kerak
    await page.click("#bundle-grid .bgift");
    await page.waitForTimeout(150);
    const opened = await page.evaluate(`(() => window.__opened || "")()`) as string;
    ok("gift Telegramda ochiladi", opened === "https://t.me/nft/poolfloat-1", opened);

    ok("konsol toza", errors.length === 0, errors.join(" | "));
    await page.close();
  }

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
