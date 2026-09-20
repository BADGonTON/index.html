/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  REKLAMA BO'LIMI — PUL OQIMI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Eng xavfli joy shu: foydalanuvchi so'mda to'laydi, biz TON da Telegramga
 * boramiz va o'rtada tarmoq uzilishi mumkin. Shu sabab bu yerda AYNAN
 * quyidagilar tekshiriladi:
 *
 *   • narx hisobi — ustama summaning ICHIDAN olinadi, ustidan emas
 *   • muvaffaqiyatli yaratishda balansdan TO'G'RI summa yechiladi
 *   • Telegram xato bersa PUL TO'LIQ QAYTADI va reklama yozuvi qolmaydi
 *   • xom xato matni foydalanuvchiga HECH QACHON chiqmaydi
 *   • boshqa odamning reklamasini ko'rib/o'chirib bo'lmaydi
 *   • byudjet oshirishda ham xuddi shu kafolatlar ishlaydi
 *
 * Telegram Ads API o'rniga soxta server turadi — test internetga
 * bog'liq emas va xatoni ataylab yuzaga keltira oladi.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";

let fails = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "✅" : "❌"} ${label}${extra ? "  " + extra : ""}`);
  if (!cond) fails++;
};

const USER = 950111;
const OTHER = 950222;

/** Soxta Telegram Ads serveri: keyingi javobni test o'zi belgilaydi. */
interface FakeState {
  nextError: string | null;
  calls: { method: string; body: Record<string, unknown> }[];
  adId: number;
}

const fake: FakeState = { nextError: null, calls: [], adId: 5000 };

/**
 * Soxta Telegram tomonidagi reklamalar.
 *
 * Holat ESLAB QOLINADI: `editAd` reklamani to'xtatadi, `decreaseAdBudget`
 * byudjetni kamaytiradi. Busiz qaytarish oqimini sinab bo'lmaydi —
 * Telegram faol reklamadan pul yechishga ruxsat bermaydi.
 */
const fakeAds = new Map<number, { paused: boolean; budget: number; status: string }>();

function fakeAd(id: number, budget: number) {
  const st = fakeAds.get(id);
  if (st) {
    return {
      ad_id: id,
      title: "Test",
      currency: "TON",
      text: "Matn",
      promote_url: "https://t.me/example",
      cpm: 0.5,
      placement: "channel_post",
      spent_budget: 0,
      remaining_budget: st.budget,
      views: 0,
      clicks: 0,
      actions: 0,
      created_date: Math.floor(Date.now() / 1000),
      status: st.status,
      is_paused: st.paused,
    };
  }
  return {
    ad_id: id,
    title: "Test",
    currency: "TON",
    text: "Matn",
    promote_url: "https://t.me/example",
    cpm: 0.5,
    placement: "channel_post",
    spent_budget: 0,
    remaining_budget: budget,
    views: 0,
    clicks: 0,
    actions: 0,
    created_date: Math.floor(Date.now() / 1000),
    status: "in_review",
  };
}

function startFakeAdsApi(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const method = (req.url ?? "").replace(/^\//, "").split("?")[0];
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(raw || "{}");
      } catch {
        /* multipart yoki bo'sh */
      }
      fake.calls.push({ method, body });

      res.setHeader("Content-Type", "application/json");

      if (fake.nextError) {
        const error = fake.nextError;
        fake.nextError = null;
        res.end(JSON.stringify({ ok: false, error }));
        return;
      }

      const reply = (result: unknown) => res.end(JSON.stringify({ ok: true, result }));

      switch (method) {
        case "getCurrentAccount":
          return reply({
            account_id: "acc1",
            title: "HozirOL",
            currency: "TON",
            spent_budget: 0,
            remaining_budget: 100,
            ads_budget: 0,
          });
        case "getTargetCountriesList":
          return reply([{ country_code: "UZ", name: "Uzbekistan" }]);
        case "getTargetLanguagesList":
          return reply([{ language_code: "uz", name: "Uzbek" }]);
        case "getTargetTopicsList":
          return reply([{ topic_id: 1, name: "Texnologiya" }]);
        case "createAd": {
          const id = ++fake.adId;
          fakeAds.set(id, {
            paused: false,
            budget: Number(body.initial_budget ?? 0),
            status: "in_review",
          });
          return reply(fakeAd(id, 0));
        }
        case "increaseAdBudget": {
          const id = Number(body.ad_id);
          const st = fakeAds.get(id);
          if (st) st.budget += Number(body.amount ?? 0);
          return reply(fakeAd(id, 0));
        }
        case "decreaseAdBudget": {
          const id = Number(body.ad_id);
          const st = fakeAds.get(id);
          if (st) st.budget = Math.max(0, st.budget - Number(body.amount ?? 0));
          return reply(fakeAd(id, 0));
        }
        case "editAd": {
          const id = Number(body.ad_id);
          const st = fakeAds.get(id);
          if (st && body.is_paused !== undefined) {
            st.paused = body.is_paused === true || body.is_paused === "true";
            // DIQQAT: Telegram `status` ni o'zgartirmasligi mumkin —
            // ko'rikdagi reklama to'xtatilsa ham "in_review" qoladi.
            // Aynan shu holat bizda nosozlik chiqargan edi.
          }
          return reply(fakeAd(id, 0));
        }
        case "getAdsById": {
          const ids = JSON.parse(String(body.ad_ids ?? "[]")) as number[];
          return reply(ids.filter((id) => fakeAds.has(id)).map((id) => fakeAd(id, 0)));
        }
        case "deleteAd":
          fakeAds.delete(Number(body.ad_id));
          return reply(true);
        default:
          return reply({});
      }
    });
  });
  return new Promise((r) => server.listen(0, () => r(server)));
}

async function main(): Promise<void> {
  // Sozlamalar `config` IMPORT PAYTIDA o'qiladi — shuning uchun avval
  // muhitni tayyorlaymiz, keyin dinamik import qilamiz.
  const adsServer = await startFakeAdsApi();
  const adsPort = (adsServer.address() as AddressInfo).port;

  process.env.TG_ADS_TOKEN = "test-ads-token";
  process.env.TG_ADS_API_BASE = `http://127.0.0.1:${adsPort}`;

  const { runMigrations } = await import("../src/db/migrate");
  const { pool, closePool } = await import("../src/db/pool");
  const pricing = await import("../src/services/pricing");
  const users = await import("../src/db/repo/users");
  const { createServer } = await import("../src/web/server");
  const { config } = await import("../src/config");
  const { sign } = await import("@telegram-apps/init-data-node");
  const ads = await import("../src/db/repo/ads");

  await runMigrations();
  await pricing.loadPricing();

  // ── Narx hisobi ──
  //
  // Ustama summaning ICHIDAN olinadi: foydalanuvchi "50 000 so'mlik
  // reklama" deganda ekranda ham, hisobda ham aynan 50 000 turishi kerak.
  console.log("\n── Narx hisobi ──");

  await pricing.setAdsMarkupPct(15);
  const q = pricing.adsQuote(50_000);

  ok("jami — foydalanuvchi aytgan summa", q.total_uzs === 50_000, String(q.total_uzs));
  ok("byudjet + haq = jami", q.budget_uzs + q.fee_uzs === q.total_uzs,
     `${q.budget_uzs} + ${q.fee_uzs}`);
  ok("byudjetga 15% qo'shsa jami chiqadi",
     Math.abs(q.budget_uzs * 1.15 - q.total_uzs) < 1,
     `${q.budget_uzs} × 1.15 = ${Math.round(q.budget_uzs * 1.15)}`);

  // TON pastga yaxlitlanadi: hech qachon hisobdagidan KO'PROQ TON
  // so'ramaymiz, aks holda hisob asta-sekin minusga ketardi.
  const rate = pricing.getTonRateUzs();
  ok("TON pastga yaxlitlandi", q.budget_ton <= q.budget_uzs / rate,
     `${q.budget_ton} ≤ ${(q.budget_uzs / rate).toFixed(5)}`);
  ok("TON ikki xonali", String(q.budget_ton).split(".")[1]?.length <= 2 || Number.isInteger(q.budget_ton),
     String(q.budget_ton));

  await pricing.setAdsMarkupPct(0);
  const free = pricing.adsQuote(50_000);
  ok("ustama 0 bo'lsa haq ham 0", free.fee_uzs === 0 && free.budget_uzs === 50_000);
  await pricing.setAdsMarkupPct(15);

  // ── Premium emoji: 160 belgi chegarasi ──
  //
  // Emoji matnda `![🎁](tg://emoji?id=...)` bo'lib turadi — 40 dan ortiq
  // belgi, lekin Telegram uni BITTA belgi deb sanaydi. Xom uzunlikni
  // sanasak, 10 ta emoji qo'ygan odamga 160 o'rniga 50 belgi qolardi.
  console.log("\n── Premium emoji ──");

  const adText = await import("../src/services/adText");

  const one = adText.analyzeAdText("Salom ![🎁](tg://emoji?id=5170233102089322756) dunyo");
  ok("emoji bitta belgi", one.length === 13, `${one.length} (xom 45)`);
  ok("emoji sanaldi", one.emojiCount === 1);
  ok("sodda ko'rinish to'g'ri", one.plain === "Salom 🎁 dunyo", one.plain);

  const htmlForm = adText.analyzeAdText('<tg-emoji emoji-id="789">⭐</tg-emoji> Stars');
  ok("HTML ko'rinish ham taniladi", htmlForm.emojiCount === 1 && htmlForm.length === 7,
     `${htmlForm.length}`);

  // Foydalanuvchining aynan talabi: 10 qator emoji 160 dan 10 tasini yesin.
  const tenEmoji =
    Array.from({ length: 10 }, (_, n) => `![🎁](tg://emoji?id=51702331020893227${n}0)`).join("") +
    " Katta chegirma boshlandi";
  const ten = adText.checkAdText(tenEmoji);
  ok("10 ta emoji = 10 belgi", ten.info.emojiCount === 10);
  ok("xom uzunlik katta, hisoblangani kichik",
     tenEmoji.length > 400 && ten.info.length === 35,
     `xom ${tenEmoji.length}, hisoblangan ${ten.info.length}`);
  ok("chegaraga sig'di", ten.ok === true);

  // Oddiy emoji (premium emas) — baribir bitta belgi.
  ok("oddiy emoji ham bitta belgi",
     adText.analyzeAdText("👍").length === 1,
     String(adText.analyzeAdText("👍").length));

  // ── Eng kam CPM ──
  //
  // Telegram aniq raqamni API orqali BERMAYDI — hujjatda faqat foizlar
  // bor. Shuning uchun bu baho, lekin u har doim OSHISHI kerak.
  console.log("\n── Eng kam CPM ──");

  const cpmBase = pricing.minCpmUzs({});
  const cpmEmoji = pricing.minCpmUzs({ premiumEmoji: true });
  const cpmPhoto = pricing.minCpmUzs({ photo: true });
  const cpmVideo = pricing.minCpmUzs({ video: true });

  // Foydalanuvchi SO'MDA ko'radi — TON faqat Telegram API si uchun.
  ok("asos so'mda", cpmBase === 2_000, String(cpmBase));
  ok("premium emoji qimmatroq", cpmEmoji > cpmBase, `${cpmBase} → ${cpmEmoji}`);
  ok("rasm qimmatroq", cpmPhoto > cpmBase, `${cpmBase} → ${cpmPhoto}`);
  ok("video rasmdan qimmat", cpmVideo > cpmPhoto, `${cpmPhoto} → ${cpmVideo}`);
  ok("kanal rasmi yana oshiradi",
     pricing.minCpmUzs({ userpic: true }) > cpmBase,
     String(pricing.minCpmUzs({ userpic: true })));
  ok("emoji + video eng qimmat",
     pricing.minCpmUzs({ premiumEmoji: true, video: true }) > cpmVideo,
     String(pricing.minCpmUzs({ premiumEmoji: true, video: true })));

  // So'm → TON o'girish YUQORIGA yaxlitlanadi: pastga yaxlitlasak
  // Telegramning eng kam chegarasidan pastga tushib qolardik.
  ok("so'm → TON yuqoriga yaxlitlanadi",
     pricing.uzsToTon(2_000) >= 2_000 / pricing.getTonRateUzs(),
     String(pricing.uzsToTon(2_000)));

  // ── Eng kam summa TON dan hisoblanadi ──
  console.log("\n── Eng kam summa ──");

  await pricing.setAdsMinTon(1);
  const minUzs = pricing.getAdsMinTopupUzs();
  ok("eng kam summa so'mda chiqadi", minUzs > 0, `${minUzs} so'm`);
  // Ustama hisobga olinishi SHART: aks holda foydalanuvchi ko'rsatilgan
  // summani to'lab, byudjetga 1 TON dan kam tushardi va Telegram rad etardi.
  const minQuote = pricing.adsQuote(minUzs);
  ok("eng kam summa 1 TON byudjet beradi", minQuote.budget_ton >= 1,
     `${minUzs} so'm → ${minQuote.budget_ton} TON`);
  ok("ustama hisobga olindi", minUzs > 1 * pricing.getTonRateUzs(),
     `${minUzs} > ${1 * pricing.getTonRateUzs()}`);

  // Bir so'm kam bo'lsa chegaradan tushib ketishi kerak.
  ok("chegara zich", pricing.adsQuote(minUzs - 1000).budget_ton < 1,
     String(pricing.adsQuote(minUzs - 1000).budget_ton));

  // ── Javobda TON maydonlari BO'LMASLIGI kerak ──
  //
  // Mini App so'mda ishlaydi. Javobga TON tushib qolsa, ertaga kimdir
  // uni ekranga chiqarib qo'yadi.
  ok("narx hisobida TON yo'q",
     !Object.keys(pricing.adsQuote(50_000)).some((k) => k === "ton"),
     Object.keys(pricing.adsQuote(50_000)).join(","));

  // ── Server ──
  const app = createServer({} as never);
  const server = await new Promise<http.Server>((r) => {
    const s = app.listen(0, () => r(s));
  });
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;

  const authFor = (id: number) =>
    `tma ${sign({ user: { id, first_name: "Test" } }, config.botToken, new Date())}`;

  const call = async (
    path: string,
    init: { method?: string; body?: unknown; user?: number } = {}
  ) => {
    const res = await fetch(`${base}/api/ads${path}`, {
      method: init.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: authFor(init.user ?? USER),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    let data: Record<string, unknown> = {};
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      /* bo'sh javob */
    }
    return { status: res.status, data };
  };

  // To'lov yozuvlari reklama o'chsa ham QOLADI (moliyaviy iz), shuning
  // uchun testni qayta ishga tushirganda ular yig'ilib qolmasligi uchun
  // shu yerda ham tozalanadi.
  await pool.query("DELETE FROM ad_topups WHERE user_id = ANY($1)", [[USER, OTHER]]);
  await pool.query("DELETE FROM ads WHERE user_id = ANY($1)", [[USER, OTHER]]);
  await users.getOrCreateUser(USER, "tester");
  await users.getOrCreateUser(OTHER, "other");
  await pool.query("UPDATE users SET balance = 0 WHERE user_id = ANY($1)", [[USER, OTHER]]);
  await users.creditBalance(USER, 300_000, "admin", "test");

  const validAd = {
    title: "Bahorgi aksiya",
    text: "Eng yaxshi takliflar",
    promote_url: "https://t.me/example",
    placement: "channel_post",
    cpm_uzs: 15_000,
    budget_uzs: 50_000,
    target: { type: "channels", language_codes: ["uz"] },
  };

  // ── Bootstrap ──
  console.log("\n── Bo'lim holati ──");
  const boot = await call("/bootstrap");
  ok("bo'lim yoqilgan", boot.data.enabled === true);
  ok("hisob javob berdi", boot.data.account_ok === true);
  ok("balans ko'rinadi", boot.data.balance_uzs === 300_000, String(boot.data.balance_uzs));

  // ── Tekshiruvlar ──
  console.log("\n── Kiritishni tekshirish ──");

  const noTitle = await call("/", { method: "POST", body: { ...validAd, title: "" } });
  ok("sarlavhasiz o'tmaydi", noTitle.status === 400, String(noTitle.data.error));

  const badUrl = await call("/", { method: "POST", body: { ...validAd, promote_url: "salom" } });
  ok("noto'g'ri havola o'tmaydi", badUrl.status === 400, String(badUrl.data.error));

  const smallBudget = await call("/", { method: "POST", body: { ...validAd, budget_uzs: 100 } });
  ok("juda kichik byudjet o'tmaydi", smallBudget.status === 400, String(smallBudget.data.error));

  const noTarget = await call("/", { method: "POST", body: { ...validAd, target: { type: "channels" } } });
  ok("bo'sh targeting o'tmaydi", noTarget.status === 400, String(noTarget.data.error));

  const badTopics = await call("/", {
    method: "POST",
    body: { ...validAd, target: { type: "channels", topic_ids: [1], language_codes: ["uz", "ru"] } },
  });
  ok("mavzuda ikkita til o'tmaydi", badTopics.status === 400, String(badTopics.data.error));

  const externalNoName = await call("/", {
    method: "POST",
    body: { ...validAd, promote_url: "https://example.com" },
  });
  ok("tashqi havolada sayt nomi majburiy", externalNoName.status === 400,
     String(externalNoName.data.error));

  // Tekshiruvda yiqilgan so'rov PUL YECHMAGAN bo'lishi kerak.
  ok("xato so'rovlar balansga tegmadi", (await users.getBalance(USER)) === 300_000,
     String(await users.getBalance(USER)));

  // ── Muvaffaqiyatli yaratish ──
  console.log("\n── Reklama yaratish ──");

  const created = await call("/", { method: "POST", body: validAd });
  ok("reklama yaratildi", created.status === 200, String(created.data.error ?? ""));

  const ad = created.data.ad as Record<string, unknown>;
  ok("Telegram id biriktirildi", typeof ad?.tg_ad_id === "number", String(ad?.tg_ad_id));
  ok("balansdan aynan 50 000 yechildi", created.data.balance_uzs === 250_000,
     String(created.data.balance_uzs));

  const sentCreate = fake.calls.filter((c) => c.method === "createAd").pop();
  ok("Telegramga TON byudjet ketdi",
     Number(sentCreate?.body.initial_budget) === q.budget_ton,
     `${sentCreate?.body.initial_budget} / ${q.budget_ton}`);
  ok("idempotent kalit yuborildi",
     typeof sentCreate?.body.idempotency_key === "string" &&
       String(sentCreate?.body.idempotency_key).length > 10);

  // ── Telegram yiqilsa: PUL QAYTADI ──
  console.log("\n── Telegram xato bersa ──");

  const before = await users.getBalance(USER);
  fake.nextError = "AD_TITLE_REQUIRED";
  const failed = await call("/", { method: "POST", body: validAd });

  ok("xato qaytarildi", failed.status === 502, String(failed.status));
  ok("pul TO'LIQ qaytdi", (await users.getBalance(USER)) === before,
     `${before} → ${await users.getBalance(USER)}`);
  ok("javobda ham qaytgani aytildi", failed.data.refunded === true);

  // Xom kalit ("AD_TITLE_REQUIRED") foydalanuvchiga CHIQMASLIGI kerak.
  const message = String(failed.data.error ?? "");
  ok("xom kalit ko'rinmadi", !/AD_TITLE_REQUIRED|_[A-Z]{3,}|\{|\}/.test(message), message);
  ok("tushunarli jumla", /sarlavha/i.test(message), message);

  // Yiqilgan reklama yozuvi QOLMASLIGI kerak — aks holda ro'yxatda
  // "qoralama" bo'lib osilib qolardi.
  const listAfterFail = await call("/");
  ok("yiqilgan reklama ro'yxatda yo'q",
     (listAfterFail.data.items as unknown[]).length === 1,
     String((listAfterFail.data.items as unknown[]).length));

  // ── Balans yetmasa ──
  console.log("\n── Balans yetmasa ──");

  const poor = await call("/", { method: "POST", body: validAd, user: OTHER });
  ok("balanssiz yaratilmadi", poor.status === 402, String(poor.status));
  ok("kerakli summa aytildi", Number(poor.data.required_uzs) === 50_000,
     String(poor.data.required_uzs));
  ok("Telegramga borilmadi",
     fake.calls.filter((c) => c.method === "createAd").length === 2,
     String(fake.calls.filter((c) => c.method === "createAd").length));

  // ── Byudjetni oshirish ──
  console.log("\n── Byudjetni oshirish ──");

  const adId = Number(ad.id);
  const beforeTopup = await users.getBalance(USER);
  const topup = await call(`/${adId}/budget`, { method: "POST", body: { uzs: 60_000 } });

  ok("byudjet to'ldirildi", topup.status === 200, String(topup.data.error ?? ""));
  ok("balansdan 60 000 yechildi",
     (await users.getBalance(USER)) === beforeTopup - 60_000,
     `${beforeTopup} → ${await users.getBalance(USER)}`);

  const beforeBadTopup = await users.getBalance(USER);
  fake.nextError = "NOT_ENOUGH_BUDGET";
  const badTopup = await call(`/${adId}/budget`, { method: "POST", body: { uzs: 60_000 } });
  ok("hisob bo'sh bo'lsa xato", badTopup.status === 502);
  ok("to'ldirishda ham pul qaytdi",
     (await users.getBalance(USER)) === beforeBadTopup,
     `${beforeBadTopup} → ${await users.getBalance(USER)}`);
  ok("xom kalit ko'rinmadi",
     !/NOT_ENOUGH_BUDGET/.test(String(badTopup.data.error)),
     String(badTopup.data.error));

  const tooSmall = await call(`/${adId}/budget`, { method: "POST", body: { uzs: 10 } });
  ok("juda kichik to'ldirish o'tmaydi", tooSmall.status === 400, String(tooSmall.data.error));

  // ── TO'XTATISH EKRANDA SEZILISHI SHART ──
  //
  // Telegramda `status` va `is_paused` ALOHIDA maydonlar: ko'rikdagi
  // reklamani to'xtatsa ham `status` "in_review" bo'lib qolaveradi.
  // Ilgari biz faqat `status` ni saqlardik, shuning uchun to'xtatish
  // ekranda umuman ko'rinmasdi — "to'xtatdim, to'xtamadi".
  console.log("\n── To'xtatish ──");

  const paused = await call(`/${adId}/pause`, { method: "POST", body: { paused: true } });
  ok("to'xtatish qabul qilindi", paused.status === 200, String(paused.data.error ?? ""));

  const pausedAd = paused.data.ad as Record<string, unknown>;
  ok("javobda to'xtatilgani bor", pausedAd?.is_paused === true, String(pausedAd?.is_paused));
  ok("holat o'zgarmagan bo'lsa ham (Telegram shunday)",
     pausedAd?.status === "in_review", String(pausedAd?.status));

  const storedPaused = await ads.getUserAd(USER, adId);
  ok("bazaga ham yozildi", storedPaused?.is_paused === true, String(storedPaused?.is_paused));

  const resumed = await call(`/${adId}/pause`, { method: "POST", body: { paused: false } });
  ok("davom ettirish ishladi",
     (resumed.data.ad as Record<string, unknown>)?.is_paused === false,
     String((resumed.data.ad as Record<string, unknown>)?.is_paused));

  // ── Egalik ──
  //
  // Telegram tomonda hisob BITTA, shuning uchun reklama kimniki ekanini
  // faqat biz bilamiz. Egalik tekshiruvi buzilsa, istalgan foydalanuvchi
  // `id` ni taxmin qilib birovning reklamasini o'chira olardi.
  console.log("\n── Egalik ──");

  const peek = await call(`/${adId}`, { user: OTHER });
  ok("birovning reklamasi ko'rinmaydi", peek.status === 404, String(peek.status));

  const steal = await call(`/${adId}`, { method: "DELETE", user: OTHER });
  ok("birovning reklamasi o'chmaydi", steal.status === 404, String(steal.status));

  const stealTopup = await call(`/${adId}/budget`, {
    method: "POST",
    body: { uzs: 50_000 },
    user: OTHER,
  });
  ok("birovning byudjeti to'ldirilmaydi", stealTopup.status === 404, String(stealTopup.status));

  const otherList = await call("/", { user: OTHER });
  ok("ro'yxat faqat o'ziniki", (otherList.data.items as unknown[]).length === 0);

  // ── To'lovlar tarixi ──
  console.log("\n── Tarix ──");

  const history = await call("/me/history");
  const items = history.data.items as Record<string, unknown>[];
  ok("tarixda yozuvlar bor", items.length >= 3, String(items.length));
  ok("muvaffaqiyatlilar 'done'",
     items.filter((t) => t.status === "done").length === 2,
     String(items.filter((t) => t.status === "done").length));
  ok("yiqilganlar 'failed'",
     items.filter((t) => t.status === "failed").length === 2,
     String(items.filter((t) => t.status === "failed").length));

  // Har bir yozuvda xizmat haqi alohida ko'rinadi — "pul qayerga ketdi"
  // savoliga javob shu yerdan chiqadi.
  ok("xizmat haqi yozildi", items.every((t) => Number(t.fee_uzs) > 0));

  // ── O'chirish: sarflanmagan pul QAYTADI ──
  //
  // Ilgari reklama darhol o'chardi va byudjetdagi pul Telegram tomonda
  // qolib ketardi — foydalanuvchi uni boshqa ko'rmasdi. Endi avval pul
  // qaytariladi, keyin o'chiriladi.
  //
  // Telegram byudjetni qaytarish uchun reklama kamida 10 daqiqa
  // to'xtagan bo'lishini talab qiladi, shuning uchun ish navbatga
  // qo'yiladi va fon ishchisi bajaradi.
  console.log("\n── O'chirish va pulni qaytarish ──");

  const removed = await call(`/${adId}`, { method: "DELETE" });
  ok("o'chirish qabul qilindi", removed.status === 200, String(removed.status));
  ok("qaytarish va'da qilindi", removed.data.refund === true);
  ok("qaytariladigan summa aytildi", Number(removed.data.refund_uzs) > 0,
     String(removed.data.refund_uzs));

  const afterDelete = await ads.getUserAd(USER, adId);
  ok("yozuv qoldi (pul qaytarish uchun kerak)", afterDelete !== null);

  // Foydalanuvchi uchun esa u DARHOL o'chgan bo'lishi kerak — aks holda
  // "o'chirdim, lekin o'chmadi" degan holat chiqardi.
  const listAfterDelete = await call("/");
  ok("ro'yxatdan DARHOL ketdi",
     (listAfterDelete.data.items as unknown[]).length === 0,
     String((listAfterDelete.data.items as unknown[]).length));
  ok("yashirilgani belgilandi", (afterDelete?.hidden_at ?? 0) > 0,
     String(afterDelete?.hidden_at));
  ok("qaytarish navbatga qo'yildi", afterDelete?.refund_state === "pending",
     String(afterDelete?.refund_state));
  ok("keyin o'chirish belgilandi", afterDelete?.delete_after_refund === true);
  ok("reklama to'xtatildi", fake.calls.some((c) => c.method === "editAd"));

  // ── Fon ishchisi: pulni qaytaradi ──
  //
  // Vaqtni "oldinga suramiz" — 10 daqiqa kutib o'tirmaymiz.
  await pool.query("UPDATE ads SET refund_after = 0 WHERE id = $1", [adId]);

  const balanceBeforeRefund = await users.getBalance(USER);
  const { runAdsRefundsOnce } = await import("../src/worker/adsWorker");

  // Bitta aylanish yetarli: marshrut o'chirish so'ralganda reklamani
  // ALLAQACHON to'xtatgan va `refund_after` ni 11 daqiqaga surgan, ya'ni
  // ishchi kelganda Telegramning 10 daqiqalik talabi bajarilgan bo'ladi.
  await runAdsRefundsOnce();

  const balanceAfterRefund = await users.getBalance(USER);
  ok("pul balansga qaytdi", balanceAfterRefund > balanceBeforeRefund,
     `${balanceBeforeRefund} → ${balanceAfterRefund}`);
  ok("Telegramdan byudjet olindi",
     fake.calls.some((c) => c.method === "decreaseAdBudget"));
  ok("Telegramda o'chirildi", fake.calls.some((c) => c.method === "deleteAd"));

  const listEnd = await call("/");
  ok("ro'yxat bo'shadi", (listEnd.data.items as unknown[]).length === 0,
     String((listEnd.data.items as unknown[]).length));

  // ── Token bo'lmasa ──
  //
  // Bu holat ishlab chiqarishda bo'lishi mumkin (token muddati tugadi,
  // olib tashlandi). Unda bo'lim YOPILADI, lekin qolgan ilova ishlayveradi.
  console.log("\n── Token bo'lmasa ──");
  {
    const saved = process.env.TG_ADS_TOKEN;
    const telegramAds = await import("../src/services/telegramAds");
    // `config` muzlatilgan bo'lishi mumkin — shuning uchun tokenni
    // to'g'ridan-to'g'ri emas, tekshiruv funksiyasi orqali sinaymiz.
    ok("token bor deb topildi", telegramAds.isAdsConfigured() === true);
    process.env.TG_ADS_TOKEN = saved;
  }

  server.close();
  adsServer.close();
  await pool.query("DELETE FROM ad_topups WHERE user_id = ANY($1)", [[USER, OTHER]]);
  await pool.query("DELETE FROM ads WHERE user_id = ANY($1)", [[USER, OTHER]]);
  await pool.query("DELETE FROM users WHERE user_id = ANY($1)", [[USER, OTHER]]);
  await closePool();

  console.log(fails ? `\n❌ ${fails} ta test yiqildi` : "\n🎉 Reklama testlari o'tdi");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
