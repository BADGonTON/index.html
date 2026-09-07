import { pool } from "../pool";

export async function addOrder(input: {
  type: string;
  buyer_id: number;
  buyer_username: string | null;
  recipient_username: string | null;
  quantity: number | null;
  months: number | null;
  ton: number | null;
  uzs: number | null;
  status: string;
  created_at: string;
}): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO orders
       (type, buyer_id, buyer_username, recipient_username, quantity, months, ton, uzs, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id`,
    [
      input.type,
      input.buyer_id,
      input.buyer_username,
      input.recipient_username,
      input.quantity,
      input.months,
      input.ton,
      input.uzs,
      input.status,
      input.created_at,
    ]
  );
  return rows[0].id;
}
