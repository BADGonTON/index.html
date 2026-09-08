import type { Api } from "grammy";
import { config, miniAppUrl } from "../config";

/**
 * Telegram bilan bog'lanish diagnostikasi.
 *
 * Mini App ochilmasligining sabablari deyarli har doim shu ro'yxatdan
 * chiqadi va ularning hech biri kod xatosi emas — sozlama yoki nginx
 * masalasi. Shuning uchun bot ishga tushganda hammasini avtomatik
 * tekshiradi va aniq xabar beradi (`/diag` buyrug'i bilan istalgan
 * vaqtda qayta ishga tushirish mumkin).
 */

export type CheckLevel = "ok" | "warn" | "fail";

export interface CheckResult {
  name: string;
  level: CheckLevel;
  detail: string;
  /** Nima qilish kerakligi — faqat muammo bo'lganda. */
  fix?: string;
}

const ICON: Record<CheckLevel, string> = { ok: "✅", warn: "⚠️", fail: "❌" };

/** Telegram Mini App'ni iframe'da ochadigan klientlar (Web / Desktop). */
const BLOCKING_HEADERS = ["x-frame-options"];

/** Shu process qachon ishga tushgan (ms). */
const PROCESS_STARTED_AT = Date.now() - Math.round(process.uptime() * 1000);

/** Bundan eski xato "o'tib ketgan" hisoblanadi (navbat bo'sh bo'lsa). */
const STALE_ERROR_MS = 10 * 60 * 1000;

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
//  Alohida tekshiruvlar
// ---------------------------------------------------------------------------

function checkPublicUrl(): CheckResult {
  if (!config.publicUrl) {
    return {
      name: "PUBLIC_URL",
      level: "fail",
      detail: "sozlanmagan — Mini App tugmasi umuman ko'rinmaydi",
      fix: ".env ga PUBLIC_URL=https://sizning-domen.uz qo'shing va botni qayta ishga tushiring",
    };
  }
  if (!config.publicUrl.startsWith("https://")) {
    return {
      name: "PUBLIC_URL",
      level: "fail",
      detail: `"${config.publicUrl}" — http:// bilan Telegram Mini App'ni ochmaydi`,
      fix: "https:// ga o'tkazing (certbot bilan bepul SSL o'rnatiladi)",
    };
  }
  return { name: "PUBLIC_URL", level: "ok", detail: miniAppUrl() };
}

/**
 * Mini App sahifasini TASHQI manzil orqali o'qiydi.
 * Bu nginx, SSL va marshrutlashni birdaniga tekshiradi — ya'ni
 * "Telegram ko'radigan narsani" ko'radi.
 */
async function checkMiniAppReachable(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  if (!config.publicUrl) return results;

  try {
    const res = await fetchWithTimeout(miniAppUrl(), 8000);

    if (!res.ok) {
      results.push({
        name: "Mini App sahifasi",
        level: "fail",
        detail: `${miniAppUrl()} → HTTP ${res.status}`,
        fix:
          res.status === 502 || res.status === 504
            ? "nginx botga ulana olmayapti — bot ishlayaptimi va PORT to'g'rimi?"
            : "nginx sozlamasini tekshiring (deploy/nginx.conf.example)",
      });
      return results;
    }

    const body = await res.text();
    const looksRight = body.includes("telegram-web-app.js");
    results.push({
      name: "Mini App sahifasi",
      level: looksRight ? "ok" : "warn",
      detail: looksRight
        ? `${miniAppUrl()} ochilyapti (${(body.length / 1024).toFixed(0)} KB)`
        : "sahifa ochildi, lekin Telegram SDK topilmadi — eski versiya keshda qolgan bo'lishi mumkin",
      fix: looksRight ? undefined : "npm run build qildingizmi? Brauzer keshini tozalab ko'ring",
    });

    // Telegram Web va Desktop Mini App'ni IFRAME ichida ochadi.
    // X-Frame-Options bo'lsa, ular uchun ilova umuman yuklanmaydi
    // (telefonda esa ishlayveradi — shuning uchun muammoni sezish qiyin).
    for (const header of BLOCKING_HEADERS) {
      const value = res.headers.get(header);
      if (value) {
        results.push({
          name: "iframe ruxsati",
          level: "fail",
          detail: `${header}: ${value} — Telegram Web/Desktop'da ilova ochilmaydi`,
          fix: `nginx sozlamasidan "add_header ${header} ..." qatorini olib tashlang`,
        });
      }
    }

    const csp = res.headers.get("content-security-policy");
    if (csp && /frame-ancestors/i.test(csp) && !/telegram\.org/i.test(csp)) {
      results.push({
        name: "iframe ruxsati",
        level: "warn",
        detail: "CSP frame-ancestors telegram.org ga ruxsat bermayapti",
        fix: "frame-ancestors ro'yxatiga https://web.telegram.org qo'shing yoki qoidani olib tashlang",
      });
    }
  } catch (err) {
    results.push({
      name: "Mini App sahifasi",
      level: "fail",
      detail: `${miniAppUrl()} ochilmadi: ${(err as Error).message}`,
      fix: "DNS domenni shu serverga yo'naltirganmi? nginx va SSL ishlayaptimi?",
    });
  }

  return results;
}

/** API ham tashqaridan ishlashi shart — Mini App aynan shu manzilga murojaat qiladi. */
async function checkApiReachable(): Promise<CheckResult> {
  if (!config.publicUrl) {
    return { name: "Mini App API", level: "warn", detail: "PUBLIC_URL yo'q — tekshirilmadi" };
  }
  try {
    const res = await fetchWithTimeout(`${config.publicUrl}/api/bootstrap`, 8000);
    // Imzosiz so'rov 401 qaytarishi TO'G'RI xatti-harakat.
    if (res.status === 401) {
      return { name: "Mini App API", level: "ok", detail: "javob beryapti va imzoni tekshiryapti" };
    }
    return {
      name: "Mini App API",
      level: "warn",
      detail: `/api/bootstrap kutilmagan javob berdi: HTTP ${res.status}`,
      fix: "nginx /api/ ni ham botga uzatyaptimi?",
    };
  } catch (err) {
    return {
      name: "Mini App API",
      level: "fail",
      detail: `/api/bootstrap ochilmadi: ${(err as Error).message}`,
      fix: "nginx barcha yo'llarni (/ ostidagi hammasini) botga uzatishi kerak",
    };
  }
}

async function checkWebhook(api: Api): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  let info;
  try {
    info = await api.getWebhookInfo();
  } catch (err) {
    return [
      {
        name: "Telegram API",
        level: "fail",
        detail: `bog'lanib bo'lmadi: ${(err as Error).message}`,
        fix: "BOT_TOKEN to'g'rimi? Serverdan api.telegram.org ochiladimi?",
      },
    ];
  }

  if (config.botMode === "webhook") {
    const expected = `${config.publicUrl}/tg/${config.webhookSecret}`;
    if (info.url === expected) {
      results.push({ name: "Webhook", level: "ok", detail: "o'rnatilgan va to'g'ri" });
    } else if (!info.url) {
      results.push({
        name: "Webhook",
        level: "fail",
        detail: "o'rnatilmagan — bot xabarlarni umuman olmaydi",
        fix: "Botni qayta ishga tushiring (u webhook'ni o'zi o'rnatadi)",
      });
    } else {
      results.push({
        name: "Webhook",
        level: "warn",
        detail: "boshqa manzilga o'rnatilgan (eski domen yoki boshqa server?)",
        fix: "PUBLIC_URL to'g'rimi? Ikkinchi nusxa ishlab turgan bo'lishi mumkin",
      });
    }

    // Telegram oxirgi xatoni YOPISHQOQ saqlaydi: u qachon bo'lganidan qat'i
    // nazar `getWebhookInfo` da turaveradi. Shuning uchun xatoning o'zi emas,
    // uning VAQTI muhim:
    //   • bot qayta ishga tushishidan oldin bo'lgan bo'lsa — restart paytidagi
    //     tabiiy 502, muammo emas;
    //   • eski bo'lsa va navbat bo'sh bo'lsa — o'tib ketgan;
    //   • yangi bo'lsa — haqiqiy muammo.
    if (info.last_error_message) {
      const at = (info.last_error_date ?? 0) * 1000;
      const when = at ? new Date(at).toLocaleString("ru-RU") : "";
      const pending = info.pending_update_count ?? 0;
      const age = Date.now() - at;

      const beforeRestart = at > 0 && at < PROCESS_STARTED_AT;
      const passed = age > STALE_ERROR_MS && pending === 0;

      // Navbat to'lib turgan bo'lsa — vaqt belgilaridan qat'i nazar, webhook
      // AYNAN HOZIR ishlamayapti. Bu eng ishonchli signal: xato eski bo'lishi
      // mumkin, lekin qayta ishlanmagan xabarlar to'planib borayotgani yangi.
      if (pending > 20) {
        results.push({
          name: "Webhook xatosi",
          level: "fail",
          detail: `${info.last_error_message} — navbatda ${pending} ta xabar to'planib qoldi`,
          fix: "Webhook hozir ham ishlamayapti. pm2 status va nginx loglarini tekshiring",
        });
      } else if (beforeRestart) {
        results.push({
          name: "Webhook xatosi (eski)",
          level: "warn",
          detail: `${info.last_error_message} — ${when}, bot qayta ishga tushishidan oldin`,
          fix: "Bu restart paytidagi tabiiy xato. Webhook hozir ishlayapti — pastdagi qatorga qarang",
        });
      } else if (passed) {
        results.push({
          name: "Webhook xatosi (o'tgan)",
          level: "warn",
          detail: `${info.last_error_message} — ${when}, o'shandan beri navbat bo'sh`,
        });
      } else {
        results.push({
          name: "Webhook xatosi",
          level: "fail",
          detail: `${info.last_error_message}${when ? ` (${when})` : ""}`,
          fix:
            info.last_error_message.includes("502") ||
            info.last_error_message.includes("Bad Gateway")
              ? "nginx botga ulana olmayapti — bot ishlayaptimi (pm2 status) va PORT to'g'rimi?"
              : "SSL sertifikat va nginx sozlamasini tekshiring",
        });
      }
    }

    if ((info.pending_update_count ?? 0) > 50) {
      results.push({
        name: "Navbatdagi xabarlar",
        level: "warn",
        detail: `${info.pending_update_count} ta xabar qayta ishlanmagan`,
        fix: "Bot to'xtab qolganmi yoki juda sekin ishlayaptimi?",
      });
    }
  } else {
    results.push({
      name: "Rejim",
      level: info.url ? "warn" : "ok",
      detail: info.url
        ? "polling, lekin webhook ham o'rnatilgan — ular bir-biriga xalaqit beradi"
        : "polling (ishlab chiqish uchun)",
      fix: info.url ? "BOT_MODE=webhook qiling yoki webhook'ni o'chiring" : undefined,
    });
  }

  return results;
}

/**
 * Webhook manzilining O'ZI hozir tirikmi?
 *
 * `getWebhookInfo` faqat o'tmishdagi xatoni ko'rsatadi, hozirgi holatni emas.
 * Shuning uchun webhook yo'liga o'zimiz murojaat qilamiz — MAXFIY SARLAVHASIZ.
 * grammY bunday so'rovni rad etadi (401), ya'ni:
 *
 *   401 → nginx botga yetib boryapti, yo'l tirik (soxta yangilanish o'tmaydi)
 *   502 → nginx botga ulana olmayapti — muammo AYNAN HOZIR bor
 *
 * Bu tekshiruv botga hech qanday soxta xabar yubormaydi.
 */
async function checkWebhookPathAlive(): Promise<CheckResult> {
  const url = `${config.publicUrl}/tg/${config.webhookSecret}`;
  try {
    const res = await fetchWithTimeout2(url);
    if (res.status === 401 || res.status === 403) {
      return { name: "Webhook yo'li", level: "ok", detail: "hozir tirik va himoyalangan" };
    }
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      return {
        name: "Webhook yo'li",
        level: "fail",
        detail: `HTTP ${res.status} — nginx botga ulana olmayapti (muammo hozir ham bor)`,
        fix: "pm2 status bilan bot ishlayotganini va PORT nginx'dagi bilan bir xilligini tekshiring",
      };
    }
    return { name: "Webhook yo'li", level: "warn", detail: `kutilmagan javob: HTTP ${res.status}` };
  } catch (err) {
    return {
      name: "Webhook yo'li",
      level: "fail",
      detail: `ochilmadi: ${(err as Error).message}`,
      fix: "nginx /tg/ yo'lini ham botga uzatyaptimi?",
    };
  }
}

/** POST so'rovi uchun (yuqoridagi tekshiruv). */
async function fetchWithTimeout2(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Chat menyusi tugmasi — foydalanuvchi ilovani xabar maydoni yonidagi
 * doimiy tugmadan ochadi. Ko'pchilik Mini App'ni aynan shu yerdan qidiradi.
 */
async function checkMenuButton(api: Api): Promise<CheckResult> {
  if (!config.publicUrl) {
    return { name: "Menyu tugmasi", level: "warn", detail: "PUBLIC_URL yo'q — o'rnatilmadi" };
  }
  try {
    const button = await api.getChatMenuButton();
    if (button.type === "web_app" && (button as any).web_app?.url === miniAppUrl()) {
      return { name: "Menyu tugmasi", level: "ok", detail: "Mini App'ga ulangan" };
    }
    return {
      name: "Menyu tugmasi",
      level: "warn",
      detail: `hozir "${button.type}" — Mini App'ga ulanmagan`,
      fix: "Botni qayta ishga tushiring (u tugmani o'zi o'rnatadi)",
    };
  } catch (err) {
    return { name: "Menyu tugmasi", level: "warn", detail: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
//  Umumiy tekshiruv
// ---------------------------------------------------------------------------

export async function runTelegramChecks(api: Api): Promise<CheckResult[]> {
  const results: CheckResult[] = [checkPublicUrl()];

  // Webhook yo'lining tirikligi `getWebhookInfo` dan MUSTAQIL tekshiriladi:
  // Telegram API ochilmagan bo'lsa ham, nginx→bot yo'li ishlayaptimi degan
  // savolga javob kerak.
  const needsWebhookPath = config.botMode === "webhook" && Boolean(config.publicUrl);

  const [webhook, menu, miniApp, apiCheck, webhookPath] = await Promise.all([
    checkWebhook(api),
    checkMenuButton(api),
    checkMiniAppReachable(),
    checkApiReachable(),
    needsWebhookPath ? checkWebhookPathAlive() : Promise.resolve(null),
  ]);

  results.push(...webhook);
  if (webhookPath) results.push(webhookPath);
  results.push(menu, ...miniApp, apiCheck);
  return results;
}

/** Konsol uchun. */
export function formatChecksForConsole(results: CheckResult[]): string {
  const lines = results.map((r) => {
    const head = `   ${ICON[r.level]} ${r.name}: ${r.detail}`;
    return r.fix ? `${head}\n      → ${r.fix}` : head;
  });
  return lines.join("\n");
}

/** Telegram xabari uchun (HTML). */
export function formatChecksForTelegram(results: CheckResult[]): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const problems = results.filter((r) => r.level !== "ok").length;
  const header = problems
    ? `🔧 <b>Telegram diagnostikasi</b>\n<i>${problems} ta muammo topildi</i>\n`
    : `🔧 <b>Telegram diagnostikasi</b>\n<i>Hammasi joyida</i>\n`;

  const body = results
    .map((r) => {
      const head = `${ICON[r.level]} <b>${escape(r.name)}</b>\n<code>${escape(r.detail)}</code>`;
      return r.fix ? `${head}\n↳ ${escape(r.fix)}` : head;
    })
    .join("\n\n");

  return `${header}\n${body}`;
}

/** Ishga tushishda chaqiriladi — muammolarni darhol ko'rsatadi. */
export async function reportTelegramChecks(api: Api): Promise<CheckResult[]> {
  const results = await runTelegramChecks(api);
  const problems = results.filter((r) => r.level !== "ok");

  console.log("\n🔧 Telegram bog'lanishi:");
  console.log(formatChecksForConsole(results));

  if (problems.length > 0) {
    console.log(
      `\n⚠️  ${problems.length} ta muammo bor — yuqoridagi "→" qatorlariga qarang.\n` +
        `   Botda /diag buyrug'i bilan istalgan vaqtda qayta tekshirasiz.\n`
    );
  } else {
    console.log("   Hammasi joyida.\n");
  }

  return results;
}

/**
 * Chat menyusi tugmasini Mini App'ga ulaydi.
 * Ishga tushishda bir marta chaqiriladi — bu Telegram tomonida saqlanadi.
 */
export async function installMenuButton(api: Api): Promise<void> {
  if (!config.publicUrl) return;
  try {
    await api.setChatMenuButton({
      menu_button: {
        type: "web_app",
        text: "Gift Arenda",
        web_app: { url: miniAppUrl() },
      },
    });
  } catch (err) {
    console.warn("⚠️  Menyu tugmasini o'rnatib bo'lmadi:", (err as Error).message);
  }
}
