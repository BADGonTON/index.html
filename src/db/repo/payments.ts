import { pool } from "../pool";
import { PaymentRow } from "../types";
import { config } from "../../config";

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Foydalanuvchiga BAND BO'LMAGAN unikal summa ajratadi va to'lovni yaratadi.
 *
 * Avvalgi versiya buni sikl bilan qilardi: `while (exists(n)) n++` — har bir
 * qadamda 2 ta SQL so'rov. Bir xil summani ko'p kishi kiritganda (masalan
 * 50 000) bu o'nlab so'rovga aylanardi. Endi bo'sh summa BITTA so'rovda
 * topiladi va o'sha zahoti band qilinadi (INSERT ... ON CONFLICT DO NOTHING
 * bilan poyga holati ham yo'q).
 */
export async function allocatePayment(userId: number, amount: number): Promise<number> {
  const staleBefore = nowSec() - config.paymentWindowSec;

  for (let attempt = 0; attempt < 50; attempt++) {
    const { rows } = await pool.query<{ candidate: number }>(
      `WITH taken AS (
         SELECT unique_sum FROM payments
          WHERE unique_sum BETWEEN $1 AND $1 + 199
            AND (status <> 'pending' OR created_at > $2)
       )
       SELECT gs AS candidate
         FROM generate_series($1::BIGINT, $1::BIGINT + 199) AS gs
        WHERE gs NOT IN (SELECT unique_sum FROM taken)
        ORDER BY gs
        LIMIT 1`,
      [amount + attempt * 200, staleBefore]
    );
    if (rows.length === 0) continue;

    const candidate = rows[0].candidate;
    const inserted = await pool.query(
      `INSERT INTO payments (unique_sum, user_id, amount, status, created_at)
       VALUES ($1, $2, $3, 'pending', $4)
       ON CONFLICT (unique_sum) DO UPDATE
         SET user_id = EXCLUDED.user_id,
             amount = EXCLUDED.amount,
             status = 'pending',
             created_at = EXCLUDED.created_at,
             post_link = NULL
       WHERE payments.status = 'pending' AND payments.created_at <= $5
       RETURNING unique_sum`,
      [candidate, userId, amount, nowSec(), staleBefore]
    );
    if ((inserted.rowCount ?? 0) > 0) return candidate;
  }

  throw new Error("Bo'sh unikal summa topilmadi — birozdan keyin qayta urinib ko'ring");
}

export async function getPayment(uniqueSum: number): Promise<PaymentRow | null> {
  const { rows } = await pool.query<PaymentRow>("SELECT * FROM payments WHERE unique_sum = $1", [
    uniqueSum,
  ]);
  return rows[0] ?? null;
}

/**
 * To'lovni 'pending' dan 'found' ga o'tkazadi — FAQAT hozir 'pending' bo'lsa.
 * Shu shart tufayli bitta to'lov ikki marta hisoblanib qolmaydi.
 */
export async function markPaymentFound(uniqueSum: number, postLink: string): Promise<PaymentRow | null> {
  const { rows } = await pool.query<PaymentRow>(
    `UPDATE payments SET status = 'found', post_link = $2
     WHERE unique_sum = $1 AND status = 'pending'
     RETURNING *`,
    [uniqueSum, postLink]
  );
  return rows[0] ?? null;
}

/**
 * Chek kelganda: 'found' to'lovni ATOMIK ravishda o'chirib, uni qaytaradi.
 * Foydalanuvchi bir nechta chek yuborsa ham balans faqat BIR MARTA to'ldiriladi,
 * chunki o'chirish va olish bitta so'rovda bajariladi.
 */
export async function consumeFoundPayment(userId: number): Promise<PaymentRow | null> {
  const { rows } = await pool.query<PaymentRow>(
    `DELETE FROM payments
      WHERE unique_sum = (
        SELECT unique_sum FROM payments
         WHERE user_id = $1 AND status = 'found'
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
      )
      RETURNING *`,
    [userId]
  );
  return rows[0] ?? null;
}

export async function deletePayment(uniqueSum: number): Promise<boolean> {
  const { rowCount } = await pool.query("DELETE FROM payments WHERE unique_sum = $1", [uniqueSum]);
  return (rowCount ?? 0) > 0;
}

/**
 * Muddati o'tgan 'pending' to'lovlarni o'chiradi va egalarini qaytaradi
 * (ular ban qilinadi + xabardor qilinadi). Fon ishchisi chaqiradi —
 * shu sabab bot qayta ishga tushsa ham to'lov "osilib" qolmaydi
 * (avval bu setTimeout bilan edi va restartda yo'qolardi).
 */
export async function expirePendingPayments(): Promise<Array<{ unique_sum: number; user_id: number }>> {
  const threshold = nowSec() - config.paymentWindowSec;
  const { rows } = await pool.query<{ unique_sum: number; user_id: number }>(
    `DELETE FROM payments
      WHERE status = 'pending' AND created_at <= $1
      RETURNING unique_sum, user_id`,
    [threshold]
  );
  return rows;
}

/**
 * Foydalanuvchining hali TOPILMAGAN ('pending') to'lovi.
 *
 * Chek keldi-yu, tasdiqlanadigan to'lov topilmaganda ishlatiladi: pul hali
 * kanalga tushmagan bo'lsa, buni foydalanuvchiga aytish kerak. Aks holda
 * bot jim turadi va "ishlamayapti" degan taassurot qoladi.
 */
export async function getPendingPayment(userId: number): Promise<PaymentRow | null> {
  const { rows } = await pool.query<PaymentRow>(
    `SELECT * FROM payments
      WHERE user_id = $1 AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId]
  );
  return rows[0] ?? null;
}
