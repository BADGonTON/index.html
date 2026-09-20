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
    kind: "backdrop_model",
    kind_label: "Fon + model",
    value: "Neon Blue · Lizard",
    backdrop: "Neon Blue",
    model: "Lizard",
    symbol: null,
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

  // Reklama bo'limi uchun soxta javoblar. Haqiqiy Telegram Ads API si
  // testda mavjud emas, bizga esa MINI APP ekranni to'g'ri chizishi kerak.
  const adsFixtures: Record<string, unknown> = {
    "/api/ads/bootstrap": {
      enabled: true,
      account_ok: true,
      balance_uzs: 500_000,
      spent_uzs: 120_000,
      ads_count: 1,
      max_ads: 50,
      markup_pct: 15,
      min_topup_uzs: 2_000,
      min_ton: 0.1,
      ton_rate_uzs: 20_000,
      cpm: { base: 0.1, premium_emoji: 0.15, photo: 0.18, video: 0.2, userpic_multiplier: 1.3, estimate: true },
      text_limit: 160,
      title_limit: 128,
      formatter_bot: "https://t.me/AdsMarkdownBot",
      refund_wait_min: 11,
      placements: ["channel_post", "bot_banner", "search_result", "video_banner"],
      buttons: ["subscribe", "view", "learn_more"],
    },
    "/api/ads/refs": {
      countries: [
        { country_code: "UZ", name: "Uzbekistan" },
        { country_code: "KZ", name: "Kazakhstan" },
      ],
      languages: [
        { language_code: "uz", name: "Uzbek" },
        { language_code: "ru", name: "Russian" },
      ],
      topics: [
        { topic_id: 1, name: "Texnologiya" },
        { topic_id: 2, name: "Biznes" },
      ],
    },
    "/api/ads/": {
      items: [
        {
          id: 1, tg_ad_id: 5001, title: "Bahorgi aksiya", text: "Eng yaxshi takliflar",
          promote_url: "https://t.me/example", placement: "channel_post",
          status: "active", decline_reason: null,
          cpm_ton: 0.5, budget_ton: 2.17, budget_uzs: 43_400,
          spent_ton: 0.4, spent_uzs: 8_000,
          views: 12_400, clicks: 310, actions: 0, ctr: 2.5,
          error: null, created_at: 1, synced_at: 1,
        },
      ],
    },
    "/api/ads/me/history": {
      items: [
        { id: 1, ad_id: 1, uzs: 50_000, ton: 2.17, fee_uzs: 6_522, status: "done", created_at: 1 },
      ],
    },
  };

  const wrapper = http.createServer((req, res) => {
    const adsPath = (req.url ?? "").split("?")[0];
    if (adsPath.startsWith("/api/ads")) {
      const fixture = adsFixtures[adsPath] ?? adsFixtures[`${adsPath}/`] ?? { items: [] };
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(fixture));
    }
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
    ok("daraja nomi ko'rindi", card?.kind?.includes("Fon + model"), card?.kind ?? "");
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
        traits: Array.prototype.map.call(document.querySelectorAll("#bundle-traits .trait"), function (t) {
          var label = t.querySelector("i").textContent.trim();
          return label + " " + t.textContent.replace(label, "").trim();
        }).join("|"),
        lit: document.querySelectorAll("#bundle-grid .bgift.is-in").length,
        total: (document.getElementById("bundle-total") || {}).textContent,
        days: (document.getElementById("bundle-days-value") || {}).textContent,
        pay: (document.getElementById("bundle-pay") || {}).textContent
      };
    })()`) as any;

    ok("to'plam detali ochildi", detail.active);
    ok("atribut chiplari chizildi", detail.traits === "Fon Neon Blue|Model Lizard", detail.traits);
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

  // ── Reklama dunyosi ──
  //
  // Ilovada IKKITA tab paneli bor va ular almashinadi. Bu joy ayniqsa
  // xatoga moyil: noto'g'ri sozlansa, foydalanuvchi reklama bo'limiga
  // kirib, GIFT panelida qolib ketadi yoki ikkala panel birdan chiqadi.
  console.log("\n── Reklama bo'limi ──");
  {
    const page = await browser.newPage({ viewport: { width: 420, height: 760 }, colorScheme: "dark" });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text());
    });

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

    const switchVisible = await page.evaluate(
      `(() => { var b = document.getElementById("switch-to-ads"); return Boolean(b) && !b.hidden; })()`
    ) as boolean;
    ok("Reklama tugmasi ko'rindi", switchVisible);

    await page.click('[data-switch="ads"]');
    await page.waitForTimeout(700);

    const world = await page.evaluate(`(() => {
      var gift = document.getElementById("tabbar-gift");
      var ads  = document.getElementById("tabbar-ads");
      var screen = document.querySelector(".screen.is-active");
      return {
        giftBarHidden: gift.hidden,
        adsBarHidden: ads.hidden,
        screen: screen ? screen.dataset.screen : "",
        wizVisible: !document.getElementById("wiz").hidden,
        gateVisible: !document.getElementById("ads-gate").hidden,
        steps: document.querySelectorAll("#wiz .wstep").length,
        stepLabel: document.getElementById("wiz-step").textContent,
        stepTitle: document.getElementById("wiz-title").textContent,
        visibleSteps: [].slice.call(document.querySelectorAll("#wiz .wstep"))
          .filter(function (n) { return !n.hidden; }).length,
        formatterBot: document.getElementById("ad-format-bot").getAttribute("href"),
        tabs: [].slice.call(document.querySelectorAll("#tabbar-ads .tab")).map(function (t) {
          return t.querySelector("span").textContent.trim();
        })
      };
    })()`) as any;

    ok("reklama ekrani ochildi", world.screen === "ads-create", world.screen);
    ok("gift paneli yashirildi", world.giftBarHidden === true);
    ok("reklama paneli ko'rindi", world.adsBarHidden === false);
    ok("wizard chiqdi (xato ekrani emas)", world.wizVisible && !world.gateVisible);
    ok("to'qqiz bosqich bor", world.steps === 9, String(world.steps));
    ok("faqat BITTA bosqich ko'rinadi", world.visibleSteps === 1, String(world.visibleSteps));
    ok("birinchi bosqich \u2014 Matn", world.stepLabel === "1 / 9" && world.stepTitle === "Matn",
       `${world.stepLabel} ${world.stepTitle}`);
    ok("formatlovchi bot havolasi bor",
       String(world.formatterBot).includes("AdsMarkdownBot"), world.formatterBot);
    ok(
      "panel: Reklama / Reklamalarim / Statistika / Profil / Gift Arenda",
      world.tabs.join(" | ") === "Reklama | Reklamalarim | Statistika | Profil | Gift Arenda",
      world.tabs.join(" | ")
    );

    // ── Premium emoji: 160 belgi chegarasi ──
    //
    // Emoji matnda uzun yozuv bo'lib turadi, lekin BITTA belgi deb
    // sanalishi kerak. Aks holda 10 ta emoji qo'ygan odamga 160 o'rniga
    // 50 belgi qolardi.
    await page.fill("#ad-text", "Salom ![\u{1F381}](tg://emoji?id=5170233102089322756) dunyo");
    await page.waitForTimeout(200);
    const counted = await page.evaluate(`(() => ({
      count: document.getElementById("ad-text-count").textContent,
      emoji: document.getElementById("ad-text-emoji").textContent,
      emojiShown: !document.getElementById("ad-text-emoji").hidden
    }))()`) as any;
    ok("emoji bitta belgi deb sanaldi", counted.count === "13", counted.count);
    ok("emoji soni ko'rsatildi", counted.emojiShown && counted.emoji === "1 premium emoji",
       counted.emoji);

    // ── Bosqichdan o'tish: bo'sh sarlavha to'xtatadi ──
    await page.click("#wiz-next");
    await page.waitForTimeout(250);
    const blocked = await page.evaluate(`(() => ({
      error: document.getElementById("wiz-error").hidden
        ? "" : document.getElementById("wiz-error").textContent,
      step: document.getElementById("wiz-step").textContent
    }))()`) as any;
    ok("sarlavhasiz o'tkazmadi", blocked.step === "1 / 9", blocked.step);
    ok("sabab aytildi", /[Ss]arlavha/.test(blocked.error), blocked.error);

    // Sarlavha yozilgach o'tadi
    await page.fill("#ad-title", "Bahorgi aksiya");
    await page.click("#wiz-next");
    await page.waitForTimeout(250);
    let step = await page.evaluate(`(() => document.getElementById("wiz-step").textContent)()`);
    ok("ikkinchi bosqichga o'tdi", step === "2 / 9", String(step));

    // ── Tashqi havola sayt nomini so'raydi ──
    await page.fill("#ad-url", "https://example.com");
    await page.waitForTimeout(200);
    const external = await page.evaluate(
      `(() => !document.getElementById("ad-website-wrap").hidden)()`
    ) as boolean;
    ok("tashqi havolada sayt nomi so'raldi", external === true);

    // Telegram havolasida so'ralmaydi
    await page.fill("#ad-url", "https://t.me/example");
    await page.waitForTimeout(200);
    const internal = await page.evaluate(
      `(() => document.getElementById("ad-website-wrap").hidden)()`
    ) as boolean;
    ok("Telegram havolasida so'ralmadi", internal === true);

    // ── Targeting bosqichigacha: 2 → 6 ──
    for (let i = 0; i < 4; i++) {
      await page.click("#wiz-next");
      await page.waitForTimeout(180);
    }
    step = await page.evaluate(`(() => document.getElementById("wiz-step").textContent)()`);
    ok("targeting bosqichiga yetdi", step === "6 / 9", String(step));

    // Targeting tanlanmasa o'tkazmasligi kerak.
    await page.click("#wiz-next");
    await page.waitForTimeout(250);
    const noTarget = await page.evaluate(`(() => ({
      step: document.getElementById("wiz-step").textContent,
      error: document.getElementById("wiz-error").hidden
        ? "" : document.getElementById("wiz-error").textContent
    }))()`) as any;
    ok("targetingsiz o'tkazmadi", noTarget.step === "6 / 9", noTarget.step);
    ok("sabab aytildi", /til|mavzu|kanal/i.test(noTarget.error), noTarget.error);

    // Til tanlaymiz \u2014 endi o'tadi.
    await page.click("#tgt-ch-langs .pick");
    await page.waitForTimeout(150);
    for (let i = 0; i < 2; i++) {
      await page.click("#wiz-next");
      await page.waitForTimeout(180);
    }
    step = await page.evaluate(`(() => document.getElementById("wiz-step").textContent)()`);
    ok("byudjet bosqichiga yetdi", step === "8 / 9", String(step));

    const cpm = await page.evaluate(`(() => ({
      value: document.getElementById("ad-cpm").value,
      hint: document.getElementById("cpm-hint").textContent
    }))()`) as any;
    ok("CPM premium emoji bo'yicha 0.15", cpm.value === "0.15", cpm.value);
    ok("sabab tushuntirildi", /premium emoji/.test(cpm.hint), cpm.hint);

    // ── Narx hisobi ──
    await page.fill("#ad-budget", "50000");
    await page.waitForTimeout(250);
    const quote = await page.evaluate(`(() => {
      var box = document.getElementById("ad-quote");
      if (box.hidden) return null;
      return {
        fee: document.getElementById("q-fee").textContent,
        total: document.getElementById("q-total").textContent,
        ton: document.getElementById("q-ton").textContent
      };
    })()`) as any;
    ok("narx hisobi chiqdi", quote !== null);
    ok("jami \u2014 kiritilgan summa", (quote?.total ?? "").replace(/\s/g, "").startsWith("50000"), quote?.total);
    ok("xizmat haqi 6 522", (quote?.fee ?? "").replace(/\s/g, "").startsWith("6522"), quote?.fee);

    // ── Natija ekrani: ko'rinish va tasdiqlash ──
    await page.click("#wiz-next");
    await page.waitForTimeout(350);
    const final = await page.evaluate(`(() => ({
      step: document.getElementById("wiz-step").textContent,
      navHidden: document.getElementById("wiz-nav").hidden,
      previewText: document.getElementById("pv-text").textContent,
      previewBtn: document.getElementById("pv-btn").textContent,
      rows: document.querySelectorAll("#pv-summary .kv").length,
      hasConfirm: Boolean(document.getElementById("wiz-confirm")),
      hasEdit: Boolean(document.getElementById("wiz-edit")),
      hasCancel: Boolean(document.getElementById("wiz-cancel"))
    }))()`) as any;

    ok("natija ekraniga yetdi", final.step === "9 / 9", final.step);
    ok("pastki boshqaruv yashirildi", final.navHidden === true);
    ok("ko'rinishda emoji ODDIY holda chiqdi",
       final.previewText === "Salom \u{1F381} dunyo", final.previewText);
    ok("tugma yozuvi bor", final.previewBtn.length > 0, final.previewBtn);
    ok("xulosa jadvali to'ldi", final.rows >= 8, String(final.rows));
    ok("tasdiqlash / tahrirlash / bekor qilish bor",
       final.hasConfirm && final.hasEdit && final.hasCancel);

    // Tahrirlash birinchi bosqichga qaytaradi
    await page.click("#wiz-edit");
    await page.waitForTimeout(250);
    step = await page.evaluate(`(() => document.getElementById("wiz-step").textContent)()`);
    ok("tahrirlash 1-bosqichga qaytardi", step === "1 / 9", String(step));

    // ── Statistika bo'limi ──
    await page.click('[data-tab="ads-stats"]');
    await page.waitForTimeout(600);
    const stats = await page.evaluate(`(() => ({
      screen: document.querySelector(".screen.is-active").dataset.screen,
      options: document.querySelectorAll("#adst-pick option").length,
      ranges: document.querySelectorAll("#adst-range button").length,
      subtitle: document.getElementById("adst-subtitle").textContent
    }))()`) as any;
    ok("statistika bo'limi ochildi", stats.screen === "ads-stats", stats.screen);
    ok("reklama tanlash ro'yxati to'ldi", stats.options === 1, String(stats.options));
    ok("davr tugmalari bor", stats.ranges === 4, String(stats.ranges));
    ok("tanlangan reklama ko'rsatildi", stats.subtitle === "Bahorgi aksiya", stats.subtitle);

    // ── Reklamalarim ──
    await page.click('[data-tab="ads-mine"]');
    await page.waitForTimeout(600);
    const mine = await page.evaluate(`(() => {
      var card = document.querySelector("#ads-list .ad-card");
      return {
        cards: document.querySelectorAll("#ads-list .ad-card").length,
        title: card ? card.querySelector(".ad-card-title").textContent.trim() : "",
        status: card ? card.querySelector(".st").textContent.trim() : ""
      };
    })()`) as any;
    ok("reklama kartochkasi chizildi", mine.cards === 1, String(mine.cards));
    ok("holat o'zbekcha", mine.status === "Faol", mine.status);

    // ── Profil: TON kursi OLIB TASHLANGAN ──
    await page.click('[data-tab="ads-profile"]');
    await page.waitForTimeout(600);
    const profile = await page.evaluate(`(() => ({
      spent: document.getElementById("adp-spent").textContent,
      markup: document.getElementById("adp-markup").textContent,
      min: document.getElementById("adp-min").textContent,
      hasRate: Boolean(document.getElementById("adp-rate")),
      hasRefunded: Boolean(document.getElementById("adp-refunded"))
    }))()`) as any;
    ok("sarflangan summa", profile.spent.replace(/\s/g, "") === "120000", profile.spent);
    ok("ustama ko'rsatildi", profile.markup === "15%", profile.markup);
    ok("eng kam summa TON bilan", /TON/.test(profile.min), profile.min);
    ok("TON kursi qatori OLIB TASHLANDI", profile.hasRate === false);
    ok("qaytarilgan summa qatori qo'shildi", profile.hasRefunded === true);

    // Gift Arendaga qaytish    // Gift Arendaga qaytish
    await page.click('[data-switch="gift"]');
    await page.waitForTimeout(500);
    const back = await page.evaluate(`(() => ({
      screen: document.querySelector(".screen.is-active").dataset.screen,
      giftBarHidden: document.getElementById("tabbar-gift").hidden,
      adsBarHidden: document.getElementById("tabbar-ads").hidden
    }))()`) as any;
    ok("Gift Arendaga qaytdi", back.screen === "market", back.screen);
    ok("gift paneli qaytdi", back.giftBarHidden === false);
    ok("reklama paneli yashirildi", back.adsBarHidden === true);

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
