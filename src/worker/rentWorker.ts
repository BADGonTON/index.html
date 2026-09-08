import { config } from "../config";
import {
  claimNextRentJob,
  finishRentJob,
  getRental,
  markRentalPaid,
  setRentalStatus,
  extendRental,
  requeueStuckRentJobs,
} from "../db/repo/rentals";
import { refundBalance } from "../db/repo/users";
import { payForRent, extendRentApi } from "../services/marketapp";
import { sendTransaction } from "../services/wallet";
import { userFacingRentError, isRetryableRentError } from "../services/rentErrors";
import { sendLog, notifyUser } from "../services/logger";
import { now } from "../util/time";
import { fmt, RENT_PAID, RENT_EXTENDED, RENT_FAILED, LOG_RENT_PAID, LOG_RENT_FAILED } from "../bot/texts";
import { rentDoneKb } from "../bot/keyboards";

/**
 * Gift Arenda uchun blokcheyn ishchisi.
 *
 * Nega alohida worker? Marketapp'ga so'rov + TON tasdiqlanishi 15-60 soniya
 * davom etadi. Eski versiyada bu HTTP so'rov ichida bo'lgani uchun Mini App
 * "muzlab" qolardi. Endi Mini App darhol javob oladi, ish esa shu yerda
 * fonda bajariladi va foydalanuvchi natijani BOTDAN xabar sifatida oladi.
 *
 * `claimNextRentJob` `FOR UPDATE SKIP LOCKED` ishlatadi, shuning uchun bir
 * nechta instance ishlasa ham bitta ish ikki marta bajarilmaydi.
 */

let running = false;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function stopRentWorker(): void {
  running = false;
}

export async function startRentWorker(): Promise<void> {
  running = true;
  const requeued = await requeueStuckRentJobs();
  if (requeued > 0) console.log(`🔁 ${requeued} ta osilib qolgan arenda ishi navbatga qaytarildi`);
  console.log("⚙️  Gift Arenda worker ishga tushdi");

  while (running) {
    try {
      const job = await claimNextRentJob();
      if (!job) {
        await sleep(1500);
        continue;
      }

      const rental = await getRental(job.rental_id);
      if (!rental) {
        await finishRentJob(job.id, "failed", "Ijara topilmadi");
        continue;
      }

      const costUzs = Number(job.payload.cost_uzs ?? 0);

      try {
        if (job.kind === "pay") {
          const tx = await payForRent(
            rental.nft_address,
            Number(rental.duration_sec),
            rental.price_per_day_nano
          );
          await sendTransaction(tx);
          await markRentalPaid(rental.id);
          await finishRentJob(job.id, "done");

          await notifyUser(
            rental.user_id,
            fmt(RENT_PAID, {
              gift: rental.nft_name,
              days: job.payload.days ?? "",
              uzs: costUzs.toLocaleString("ru-RU"),
            }),
            { reply_markup: rentDoneKb() }
          );
          await sendLog(
            fmt(LOG_RENT_PAID, {
              buyer_username: "",
              buyer_id: rental.user_id,
              gift: rental.nft_name,
              days: job.payload.days ?? "",
              uzs: costUzs.toLocaleString("ru-RU"),
              datetime: now(),
            })
          );
        } else {
          const extraSec = Number(job.payload.extra_sec ?? 0);
          const tx = await extendRentApi(rental.nft_address, extraSec, rental.price_per_day_nano);
          await sendTransaction(tx);
          await extendRental(rental.id, extraSec);
          await finishRentJob(job.id, "done");

          await notifyUser(
            rental.user_id,
            fmt(RENT_EXTENDED, {
              gift: rental.nft_name,
              days: job.payload.days ?? "",
              uzs: costUzs.toLocaleString("ru-RU"),
            }),
            { reply_markup: rentDoneKb() }
          );
        }

        console.log(`✅ Arenda ishi #${job.id} (${job.kind}) yakunlandi`);
      } catch (err) {
        // XOM matn — faqat jurnal va adminlar uchun.
        const errorMsg = (err as Error).message;
        // Foydalanuvchi ko'radigan sodda jumla.
        const userMsg = userFacingRentError(errorMsg);
        console.error(`❌ Arenda ishi #${job.id} xato:`, errorMsg);

        // "Gift allaqachon band" kabi xatoda qayta urinishdan foyda yo'q —
        // uch marta urinib, orada 70 soniya kuttirgandan ko'ra pulni
        // DARHOL qaytargan ma'qul.
        if (isRetryableRentError(errorMsg) && job.retries < config.maxRetries) {
          await finishRentJob(job.id, "pending", errorMsg);
          const waitSec = 10 * 2 ** job.retries;
          console.log(`🔁 Arenda ishi #${job.id} ${waitSec}s dan keyin qayta uriniladi`);
          await sleep(waitSec * 1000);
          continue;
        }

        // Butunlay muvaffaqiyatsiz — pulni to'liq qaytaramiz.
        //
        // Navbat yozuvida XOM matn qoladi (nosozlikni izlash uchun),
        // ijara yozuvida esa foydalanuvchi ko'radigan jumla — Mini App
        // aynan `tx_error` ni ko'rsatadi.
        await finishRentJob(job.id, "failed", errorMsg);
        if (job.kind === "pay") await setRentalStatus(rental.id, "failed", userMsg);
        await refundBalance(rental.user_id, costUzs, rental.id);

        await notifyUser(
          rental.user_id,
          fmt(RENT_FAILED, {
            gift: rental.nft_name,
            uzs: costUzs.toLocaleString("ru-RU"),
            error: userMsg,
          })
        );
        await sendLog(
          fmt(LOG_RENT_FAILED, {
            buyer_id: rental.user_id,
            gift: rental.nft_name,
            uzs: costUzs.toLocaleString("ru-RU"),
            error: errorMsg.slice(0, 300),
            datetime: now(),
          })
        );
      }

      await sleep(config.txDelaySec * 1000);
    } catch (err) {
      console.error("❌ Arenda worker kritik xatosi:", (err as Error).message);
      await sleep(5000);
    }
  }
}
