import {
  listDueRefunds,
  listDeclinedNeedingRefund,
  listAdsToSync,
  scheduleRefund,
  finishRefund,
  retryRefundLater,
  syncAdFromTelegram,
  deleteAdRow,
  AdRow,
} from "../db/repo/ads";
import {
  getAdsById,
  editAd,
  decreaseAdBudget,
  deleteAd as deleteTelegramAd,
  newIdempotencyKey,
  isAdsConfigured,
} from "../services/telegramAds";
import { adsErrorForLog } from "../services/adsErrors";
import { tonToUzs } from "../services/pricing";
import { creditBalance } from "../db/repo/users";
import { sendLog, notifyUser } from "../services/logger";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  REKLAMA FON ISHCHISI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ikki ish qiladi:
 *
 *  1. HOLATNI YANGILAYDI. Telegram reklamani ko'rikdan o'tkazadi, rad etadi,
 *     pul sarflaydi — bularning hech biri bizga o'zi xabar qilinmaydi.
 *     Shuning uchun vaqti-vaqti bilan so'rab turamiz.
 *
 *  2. SARFLANMAGAN PULNI QAYTARADI. Reklama rad etilsa yoki foydalanuvchi
 *     uni o'chirsa, byudjetdagi sarflanmagan TON foydalanuvchiniki bo'ladi.
 *
 * NEGA DARHOL EMAS: Telegram `decreaseAdBudget` va `deleteAd` uchun reklama
 * KAMIDA 10 DAQIQA to'xtagan bo'lishini talab qiladi. Shu sabab qaytarish
 * navbatga qo'yiladi — foydalanuvchi kutib o'tirmaydi, pul esa yo'qolmaydi.
 */

/** Holatlarni yangilash oralig'i. */
const SYNC_INTERVAL_MS = 5 * 60_000;

/** Qaytarish navbatini tekshirish oralig'i. */
const REFUND_INTERVAL_MS = 60_000;

/** Bitta aylanishda shuncha reklama yangilanadi. */
const SYNC_BATCH = 25;

/** Shu muddatdan eski ma'lumot "eskirgan" hisoblanadi. */
const STALE_SEC = 10 * 60;

let syncTimer: NodeJS.Timeout | null = null;
let refundTimer: NodeJS.Timeout | null = null;

export function stopAdsWorker(): void {
  if (syncTimer) clearInterval(syncTimer);
  if (refundTimer) clearInterval(refundTimer);
  syncTimer = null;
  refundTimer = null;
}

export function startAdsWorker(): void {
  if (!isAdsConfigured()) return;

  console.log("⚙️  Reklama worker ishga tushdi");

  syncTimer = setInterval(() => {
    void syncAds().catch((err) => console.error("Reklama sinxroni:", adsErrorForLog(err)));
  }, SYNC_INTERVAL_MS);

  refundTimer = setInterval(() => {
    void processRefunds().catch((err) =>
      console.error("Reklama qaytarishi:", adsErrorForLog(err))
    );
  }, REFUND_INTERVAL_MS);
}

// ───────────────────────── Holatni yangilash ─────────────────────────

/**
 * Eskirgan reklamalarning holatini Telegramdan olib, keshga yozadi.
 *
 * Shu yerda RAD ETILGANLAR ham topiladi: Telegram rad etsa, byudjetdagi
 * pul foydalanuvchiniki bo'lib qoladi va uni qaytarish navbatiga qo'yamiz.
 */
async function syncAds(): Promise<void> {
  const rows = await listAdsToSync(SYNC_BATCH, STALE_SEC);
  if (rows.length === 0) return;

  const ids = rows.map((r) => r.tg_ad_id!).filter(Boolean);
  const fresh = await getAdsById(ids);

  for (const ad of fresh) {
    await syncAdFromTelegram(ad);
  }

  // Rad etilganlarning pulini qaytarish navbatiga qo'yamiz.
  const declined = await listDeclinedNeedingRefund();
  for (const row of declined) {
    await scheduleRefund(row.id, false);
    await notifyUser(
      row.user_id,
      `❌ <b>Reklama rad etildi</b>\n\n` +
        `<b>${escapeHtml(row.title)}</b>\n` +
        (row.decline_reason ? `\n${escapeHtml(row.decline_reason)}\n` : "") +
        `\nSarflanmagan byudjet balansingizga qaytariladi.`
    );
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
}

// ───────────────────────── Pulni qaytarish ─────────────────────────

/**
 * Navbatdagi qaytarishlarni bajaradi.
 *
 * Tartib qat'iy va shu tartib MUHIM:
 *
 *   1. Telegramdan reklamaning HOZIRGI holatini olamiz — qancha
 *      sarflangani faqat o'sha yerda aniq. O'zimizdagi keshga
 *      ishonsak, foydalanuvchiga sarflangan pulni ham qaytarib
 *      yuborishimiz mumkin edi.
 *   2. Reklamani to'xtatamiz (to'xtamagan bo'lsa).
 *   3. `decreaseAdBudget` bilan qolgan TON ni hisobga qaytaramiz.
 *   4. Foydalanuvchi balansiga so'mda yozamiz.
 *   5. Kerak bo'lsa reklamani o'chiramiz.
 *
 * Har bir qadam yiqilishi mumkin — unda urinish keyinga suriladi va
 * hech narsa yo'qolmaydi: keyingi aylanishda yana 1-qadamdan boshlanadi.
 */
export async function runAdsRefundsOnce(): Promise<void> {
  await processRefunds();
}

async function processRefunds(): Promise<void> {
  const due = await listDueRefunds();

  for (const row of due) {
    try {
      await refundOne(row);
    } catch (err) {
      const message = adsErrorForLog(err);
      const willRetry = await retryRefundLater(row.id, message);

      console.error(
        `❌ Reklama #${row.id} puli qaytmadi (${row.refund_tries + 1}-urinish):`,
        message
      );

      if (!willRetry) {
        await sendLog(
          `⚠️ <b>REKLAMA PULI QAYTMADI</b>\n\n` +
            `Reklama <code>${row.id}</code> · foydalanuvchi <code>${row.user_id}</code>\n` +
            `Byudjet: ${tonToUzs(row.budget_ton).toLocaleString("ru-RU")} so'm\n` +
            `Sabab: ${escapeHtml(message)}\n\n` +
            `Qo'lda hal qilish kerak.`
        );
      }
    }
  }
}

async function refundOne(row: AdRow): Promise<void> {
  const tgId = row.tg_ad_id!;

  // 1. Hozirgi holat — faqat Telegram biladi.
  const [fresh] = await getAdsById([tgId]);

  if (!fresh) {
    // Reklama Telegramda yo'q: qaytaradigan narsa qolmagan.
    await finishRefund(row.id, 0);
    if (row.delete_after_refund) await deleteAdRow(row.id);
    return;
  }

  await syncAdFromTelegram(fresh);

  // 2. To'xtatamiz — Telegram faol reklamadan pul yechishga ruxsat bermaydi.
  if (!fresh.is_paused && fresh.status !== "stopped") {
    await editAd(tgId, { is_paused: true });
    // To'xtatgandan keyin yana 10 daqiqa kutish kerak.
    await retryRefundLater(row.id, "to'xtatildi, 10 daqiqa kutilmoqda");
    return;
  }

  const remaining = Number(fresh.remaining_budget ?? 0);

  // 3. Qolgan byudjetni hisobga qaytaramiz.
  if (remaining > 0) {
    await decreaseAdBudget(tgId, remaining, newIdempotencyKey());
  }

  // 4. Foydalanuvchi balansiga.
  //
  // Xizmat haqi QAYTARILMAYDI: u ish bajarilgani uchun olingan. Faqat
  // Telegramda sarflanmay qolgan byudjet qaytadi.
  const refundUzs = tonToUzs(remaining);
  if (refundUzs > 0) {
    await creditBalance(row.user_id, refundUzs, "refund", row.id);
    await notifyUser(
      row.user_id,
      `♻️ <b>Pul qaytarildi</b>\n\n` +
        `<b>${escapeHtml(row.title)}</b> reklamasidan sarflanmagan\n` +
        `<b>${refundUzs.toLocaleString("ru-RU")} so'm</b> balansingizga qaytarildi.`
    );
  }

  await finishRefund(row.id, remaining);

  // 5. O'chirish so'ralgan bo'lsa — endi xavfsiz: pul olingan.
  if (row.delete_after_refund) {
    await deleteTelegramAd(tgId).catch(() => {
      // Telegramda o'chmasa ham bizdagi yozuv ketadi: pul qaytarilgan,
      // reklama to'xtatilgan. Foydalanuvchi uchun ish tugadi.
    });
    await deleteAdRow(row.id);
  }

  await sendLog(
    `♻️ Reklama #${row.id} puli qaytarildi: ` +
      `${refundUzs.toLocaleString("ru-RU")} so'm → <code>${row.user_id}</code>`
  );
}
