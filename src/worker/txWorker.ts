import type { Api } from "grammy";
import { config } from "../config";
import {
  getNextPendingTx,
  updateTxStatus,
  incrementTxRetries,
  getStuckSendingTxs,
} from "../db/repo/transactions";
import { getBalance, refundBalance } from "../db/repo/users";
import { getWallet, sendTransaction } from "../services/wallet";
import { sendLog, notifyUser } from "../services/logger";
import { now } from "../util/time";
import {
  fmt,
  STARS_SUCCESS,
  PREMIUM_SUCCESS,
  LOG_STARS_SUCCESS,
  LOG_PREMIUM_SUCCESS,
  LOG_TX_ERROR,
  LOG_STUCK_TX,
  ERROR_BLOCKCHAIN,
} from "../bot/texts";

/**
 * Stars/Premium tranzaksiyalarini TON tarmog'iga KETMA-KET yuboradi.
 *
 * Nega ketma-ket? Bitta hamyondan bir vaqtda ikkita TX yuborilsa `seqno`
 * to'qnashadi va bittasi yo'qoladi. Shu sabab bot xaridni "navbat" qilib
 * ko'rsatadi — bu xato emas, ataylab shunday.
 *
 * Xatolikda MAX_RETRIES gacha qayta uriniladi, so'ng foydalanuvchining puli
 * to'liq qaytariladi.
 */

let running = false;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function stopTxWorker(): void {
  running = false;
}

export async function startTxWorker(api: Api): Promise<void> {
  running = true;
  console.log("⚙️  Stars/Premium worker ishga tushdi");

  while (running) {
    try {
      const jobRow = await getNextPendingTx();
      if (!jobRow) {
        await sleep(1000);
        continue;
      }

      const job = JSON.parse(jobRow.data_json);
      const jobId = jobRow.id;
      const retries = jobRow.retries;

      await updateTxStatus(jobId, "sending");

      try {
        const before = await getWallet();
        await sendTransaction(job.tx);
        const after = await getWallet();

        const balance = await getBalance(job.buyer_id);
        const common = {
          buyer_username: job.buyer_username,
          buyer_id: job.buyer_id,
          recipient_username: job.recipient_username,
          uzs: job.uzs,
          ton: job.ton,
          before: before.balanceTon.toFixed(4),
          after: after.balanceTon.toFixed(4),
          datetime: now(),
        };

        if (job.type === "stars") {
          await notifyUser(
            job.buyer_id,
            fmt(STARS_SUCCESS, {
              quantity: job.quantity,
              username: job.recipient_username,
              uzs: job.uzs,
              balance,
              datetime: now(),
            })
          );
          await sendLog(fmt(LOG_STARS_SUCCESS, { ...common, quantity: job.quantity }));
        } else if (job.type === "premium") {
          await notifyUser(
            job.buyer_id,
            fmt(PREMIUM_SUCCESS, {
              months: job.months,
              username: job.recipient_username,
              uzs: job.uzs,
              balance,
              datetime: now(),
            })
          );
          await sendLog(fmt(LOG_PREMIUM_SUCCESS, { ...common, months: job.months }));
        }

        await updateTxStatus(jobId, "done");
        console.log(`✅ TX #${jobId} (${job.type}) yakunlandi`);
      } catch (err) {
        const errorMsg = (err as Error).message;
        console.error(`❌ TX #${jobId} xato:`, errorMsg);

        await sendLog(
          fmt(LOG_TX_ERROR, {
            tx_type: job.type,
            retry: retries + 1,
            max_retry: config.maxRetries,
            error: errorMsg,
            datetime: now(),
          })
        );

        if (retries < config.maxRetries) {
          await incrementTxRetries(jobId);
          await updateTxStatus(jobId, "pending");
          const waitSec = 10 * 2 ** retries;
          console.log(`🔁 TX #${jobId} ${waitSec}s dan keyin qayta uriniladi`);
          await sleep(waitSec * 1000);
          continue;
        }

        await updateTxStatus(jobId, "failed", errorMsg);
        await refundBalance(job.buyer_id, job.uzs, jobId);
        await notifyUser(job.buyer_id, ERROR_BLOCKCHAIN);
        console.error(`💸 TX #${jobId} bekor qilindi, ${job.uzs} so'm qaytarildi`);
      }

      await sleep(config.txDelaySec * 1000);
    } catch (err) {
      console.error("❌ Worker kritik xatosi:", (err as Error).message);
      await sleep(5000);
    }
  }
}

/** Restartdan keyin 'sending' holatida qolib ketgan TX lar haqida ogohlantiradi. */
export async function recoverStuckTxs(): Promise<void> {
  const stuck = await getStuckSendingTxs();
  for (const txRow of stuck) {
    try {
      const job = JSON.parse(txRow.data_json);
      await sendLog(
        fmt(LOG_STUCK_TX, {
          tx_id: txRow.id,
          tx_type: job.type,
          recipient_username: job.recipient_username ?? "",
          uzs: job.uzs ?? 0,
        })
      );
    } catch {
      // Buzuq JSON — e'tiborsiz qoldiramiz.
    }
  }
}
