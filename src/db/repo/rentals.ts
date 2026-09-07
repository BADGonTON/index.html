import { pool, withTransaction } from "../pool";

/**
 * "Gift Arenda" ijaralari. Holat mashinasi:
 *
 *   draft ──▶ paying ──▶ pending_link ──▶ linked ──▶ expired
 *               │
 *               └──▶ failed   (blokcheyn xatosi — pul qaytariladi)
 *
 * Har bir o'tish SQL shartida tekshiriladi (`WHERE status = '...'`), shuning
 * uchun bir xil ijara uchun ikki marta to'lov qilib bo'lmaydi — bu eski
 * SQLite versiyadagi haqiqiy xato edi.
 */
export type RentalStatus = "draft" | "paying" | "pending_link" | "linked" | "failed" | "expired";

export interface RentalRow {
  id: number;
  user_id: number;
  nft_address: string;
  nft_name: string;
  collection_name: string | null;
  collection_address: string | null;
  duration_sec: number;
  price_per_day_nano: string; // NUMERIC — string sifatida o'qiladi (2^53 dan katta bo'lishi mumkin)
  paid_uzs: number;
  status: RentalStatus;
  tonconnect_url: string | null;
  tx_error: string | null;
  end_time: number | null;
  created_at: number;
  updated_at: number;
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export async function createRental(input: {
  userId: number;
  nftAddress: string;
  nftName: string;
  collectionName: string | null;
  collectionAddress: string | null;
  durationSec: number;
  pricePerDayNano: string;
  paidUzs: number;
}): Promise<RentalRow> {
  const ts = nowSec();
  const { rows } = await pool.query<RentalRow>(
    `INSERT INTO rentals
       (user_id, nft_address, nft_name, collection_name, collection_address,
        duration_sec, price_per_day_nano, paid_uzs, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$9)
     RETURNING *`,
    [
      input.userId,
      input.nftAddress,
      input.nftName,
      input.collectionName,
      input.collectionAddress,
      input.durationSec,
      input.pricePerDayNano,
      input.paidUzs,
      ts,
    ]
  );
  return rows[0];
}

export async function getRental(id: number, userId?: number): Promise<RentalRow | null> {
  const { rows } = userId
    ? await pool.query<RentalRow>("SELECT * FROM rentals WHERE id = $1 AND user_id = $2", [id, userId])
    : await pool.query<RentalRow>("SELECT * FROM rentals WHERE id = $1", [id]);
  return rows[0] ?? null;
}

/**
 * 'draft' → 'paying'. Faqat bitta chaqiruv muvaffaqiyatli bo'ladi, qolganlari
 * `null` oladi — ikki marta to'lashning oldini oladigan asosiy himoya.
 */
export async function lockRentalForPayment(id: number, userId: number): Promise<RentalRow | null> {
  const { rows } = await pool.query<RentalRow>(
    `UPDATE rentals SET status = 'paying', updated_at = $3
      WHERE id = $1 AND user_id = $2 AND status = 'draft'
      RETURNING *`,
    [id, userId, nowSec()]
  );
  return rows[0] ?? null;
}

export async function setRentalStatus(
  id: number,
  status: RentalStatus,
  errorMsg?: string | null
): Promise<void> {
  await pool.query("UPDATE rentals SET status = $2, tx_error = $3, updated_at = $4 WHERE id = $1", [
    id,
    status,
    errorMsg ?? null,
    nowSec(),
  ]);
}

/** To'lov blokcheynda tasdiqlandi → foydalanuvchi endi profilini ulashi mumkin. */
export async function markRentalPaid(id: number): Promise<void> {
  await pool.query(
    "UPDATE rentals SET status = 'pending_link', tx_error = NULL, updated_at = $2 WHERE id = $1",
    [id, nowSec()]
  );
}

export async function markRentalLinked(id: number, tonconnectUrl: string, endTime: number): Promise<void> {
  await pool.query(
    `UPDATE rentals SET status = 'linked', tonconnect_url = $2, end_time = $3, updated_at = $4
      WHERE id = $1`,
    [id, tonconnectUrl, endTime, nowSec()]
  );
}

export async function extendRental(id: number, extraSec: number): Promise<void> {
  await pool.query(
    `UPDATE rentals
        SET duration_sec = duration_sec + $2,
            end_time = GREATEST(COALESCE(end_time, $3), $3) + $2,
            updated_at = $3
      WHERE id = $1`,
    [id, extraSec, nowSec()]
  );
}

/** Foydalanuvchining "Mening giftlarim" ro'yxati — bitta so'rovda. */
export async function listUserRentals(userId: number): Promise<RentalRow[]> {
  const { rows } = await pool.query<RentalRow>(
    `SELECT * FROM rentals
      WHERE user_id = $1 AND status IN ('paying','pending_link','linked','failed')
      ORDER BY id DESC
      LIMIT 100`,
    [userId]
  );
  return rows;
}

/** Muddati tugagan ijaralarni 'expired' qiladi (fon ishchisi chaqiradi). */
export async function expireFinishedRentals(): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE rentals SET status = 'expired', updated_at = $1
      WHERE status = 'linked' AND end_time IS NOT NULL AND end_time <= $1`,
    [nowSec()]
  );
  return rowCount ?? 0;
}

// ---------------------------------------------------------------------------
//  Blokcheyn navbati (rent_jobs)
// ---------------------------------------------------------------------------

export interface RentJobRow {
  id: number;
  rental_id: number;
  kind: "pay" | "extend";
  payload: { days?: number; extra_sec?: number; cost_uzs: number };
  status: string;
  retries: number;
  error_msg: string | null;
  created_at: number;
  updated_at: number;
}

export async function enqueueRentJob(
  rentalId: number,
  kind: "pay" | "extend",
  payload: RentJobRow["payload"]
): Promise<number> {
  const ts = nowSec();
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO rent_jobs (rental_id, kind, payload, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'pending', $4, $4)
     RETURNING id`,
    [rentalId, kind, JSON.stringify(payload), ts]
  );
  return rows[0].id;
}

/**
 * Navbatdan keyingi ishni ATOMIK ravishda oladi va 'sending' qiladi.
 * `FOR UPDATE SKIP LOCKED` tufayli bir nechta instance bir vaqtda ishlasa ham
 * bitta ishni ikki marta bajarmaydi.
 */
export async function claimNextRentJob(): Promise<RentJobRow | null> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<RentJobRow>(
      `UPDATE rent_jobs SET status = 'sending', updated_at = $1
        WHERE id = (
          SELECT id FROM rent_jobs
           WHERE status = 'pending'
           ORDER BY id ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED
        )
        RETURNING *`,
      [nowSec()]
    );
    return rows[0] ?? null;
  });
}

export async function finishRentJob(
  id: number,
  status: "done" | "failed" | "pending",
  errorMsg?: string | null
): Promise<void> {
  await pool.query(
    `UPDATE rent_jobs
        SET status = $2,
            error_msg = $3,
            retries = retries + CASE WHEN $2 = 'pending' THEN 1 ELSE 0 END,
            updated_at = $4
      WHERE id = $1`,
    [id, status, errorMsg ?? null, nowSec()]
  );
}

/** Restartda 'sending' holatida qolib ketgan ishlarni navbatga qaytaradi. */
export async function requeueStuckRentJobs(): Promise<number> {
  const { rowCount } = await pool.query(
    "UPDATE rent_jobs SET status = 'pending', updated_at = $1 WHERE status = 'sending'",
    [nowSec()]
  );
  return rowCount ?? 0;
}

export async function getRentQueueSize(): Promise<number> {
  const { rows } = await pool.query<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM rent_jobs WHERE status IN ('pending','sending')"
  );
  return rows[0].count;
}
