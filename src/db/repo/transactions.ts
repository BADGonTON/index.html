import { pool } from "../pool";
import { PendingTxRow } from "../types";

export async function addPendingTx(txType: string, dataJson: string, createdAt: string): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO pending_txs (type, data_json, status, created_at)
     VALUES ($1, $2, 'pending', $3) RETURNING id`,
    [txType, dataJson, createdAt]
  );
  return rows[0].id;
}

/** Faqat status='pending' TX ni oladi. 'sending' larni OLMAYDI. */
export async function getNextPendingTx(): Promise<PendingTxRow | null> {
  const { rows } = await pool.query<PendingTxRow>(
    `SELECT * FROM pending_txs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1`
  );
  return rows[0] ?? null;
}

export async function updateTxStatus(
  txId: number,
  status: string,
  errorMsg?: string | null
): Promise<boolean> {
  const { rowCount } = errorMsg
    ? await pool.query("UPDATE pending_txs SET status = $1, error_msg = $2 WHERE id = $3", [
        status,
        errorMsg,
        txId,
      ])
    : await pool.query("UPDATE pending_txs SET status = $1 WHERE id = $2", [status, txId]);
  return (rowCount ?? 0) > 0;
}

export async function incrementTxRetries(txId: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    "UPDATE pending_txs SET retries = retries + 1 WHERE id = $1",
    [txId]
  );
  return (rowCount ?? 0) > 0;
}

/** Navbatdagi TX soni ('pending' + 'sending') */
export async function getQueueSize(): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::int AS count FROM pending_txs WHERE status IN ('pending', 'sending')`
  );
  return Number(rows[0].count);
}

/** Bot restart bo'lganda 'sending' da qolib ketgan TX larni qaytaradi. */
export async function getStuckSendingTxs(): Promise<PendingTxRow[]> {
  const { rows } = await pool.query<PendingTxRow>("SELECT * FROM pending_txs WHERE status = 'sending'");
  return rows;
}

/** Muvaffaqiyatli yakunlangan TX lar soni */
export async function getTotalOrders(): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::int AS count FROM pending_txs WHERE status = 'done'`
  );
  return Number(rows[0].count);
}
