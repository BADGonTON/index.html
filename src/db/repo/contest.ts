import { pool, withTransaction } from "../pool";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  REFERAL KONKURSI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * "Taklif qilish" degani havolani bosish EMAS. Taklif qilingan odam
 * KANALGA A'ZO BO'LGANDAN keyin sanaladi — shu sabab taklif
 * `users.referrer_id` dan alohida, `contest_refs` ga yoziladi.
 *
 * Farqi muhim:
 *   users.referrer_id  — "kim kimni chaqirgan" (pul bonusi uchun)
 *   contest_refs       — "kim HISOBGA olingan" (konkurs uchun)
 */

export interface ContestRow {
  id: number;
  title: string;
  prize: string;
  winners_count: number;
  status: "active" | "finished";
  started_at: number;
  finished_at: number | null;
}

export interface LeaderRow {
  user_id: number;
  username: string | null;
  invites: number;
}

export interface WinnerRow {
  place: number;
  user_id: number;
  username: string | null;
  invites: number;
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function toContest(raw: Record<string, unknown>): ContestRow {
  return {
    ...(raw as unknown as ContestRow),
    id: Number(raw.id),
    winners_count: Number(raw.winners_count ?? 3),
    started_at: Number(raw.started_at ?? 0),
    finished_at: raw.finished_at === null ? null : Number(raw.finished_at),
  };
}

// ───────────────────────────── Konkurs ─────────────────────────────

/** Hozir davom etayotgan konkurs (yo'q bo'lsa null). */
export async function getActiveContest(): Promise<ContestRow | null> {
  const { rows } = await pool.query(
    "SELECT * FROM contests WHERE status = 'active' ORDER BY id DESC LIMIT 1"
  );
  return rows.length > 0 ? toContest(rows[0]) : null;
}

export async function getContest(id: number): Promise<ContestRow | null> {
  const { rows } = await pool.query("SELECT * FROM contests WHERE id = $1", [id]);
  return rows.length > 0 ? toContest(rows[0]) : null;
}

/**
 * Yangi konkurs boshlaydi.
 *
 * Bazada "bir vaqtda bitta faol konkurs" qoidasi UNIQUE indeks bilan
 * qo'yilgan, shuning uchun ikkinchisini boshlashga urinish xato beradi —
 * va bu to'g'ri: ikkita faol konkursda taklif qaysi biriga yozilishi
 * noaniq bo'lardi.
 */
export async function startContest(input: {
  title: string;
  prize: string;
  winnersCount: number;
}): Promise<ContestRow> {
  const { rows } = await pool.query(
    `INSERT INTO contests (title, prize, winners_count, status, started_at)
     VALUES ($1, $2, $3, 'active', $4)
     RETURNING *`,
    [input.title, input.prize, input.winnersCount, nowSec()]
  );
  return toContest(rows[0]);
}

export async function updateContest(
  id: number,
  patch: { title?: string; prize?: string; winnersCount?: number }
): Promise<void> {
  await pool.query(
    `UPDATE contests
        SET title = COALESCE($2, title),
            prize = COALESCE($3, prize),
            winners_count = COALESCE($4, winners_count)
      WHERE id = $1`,
    [id, patch.title ?? null, patch.prize ?? null, patch.winnersCount ?? null]
  );
}

/**
 * Konkursni yakunlaydi va g'oliblarni MUZLATADI.
 *
 * Nega muzlatiladi: yakunlangandan keyin ham odamlar kanalga qo'shilishi
 * mumkin. Agar g'oliblar har safar qaytadan hisoblansa, e'lon qilingan
 * ro'yxat keyinroq o'zgarib ketardi — bu konkursda qabul qilib
 * bo'lmaydigan narsa.
 *
 * Hammasi BITTA tranzaksiyada: yarim yakunlangan konkurs qolmaydi.
 */
export async function finishContest(id: number): Promise<WinnerRow[]> {
  return withTransaction(async (client) => {
    const { rows: contestRows } = await client.query(
      "SELECT * FROM contests WHERE id = $1 AND status = 'active' FOR UPDATE",
      [id]
    );
    if (contestRows.length === 0) return [];

    const contest = toContest(contestRows[0]);

    const { rows: leaders } = await client.query<{
      user_id: string;
      username: string | null;
      invites: string;
    }>(
      `SELECT r.inviter_id AS user_id, u.username, COUNT(*) AS invites
         FROM contest_refs r
         LEFT JOIN users u ON u.user_id = r.inviter_id
        WHERE r.contest_id = $1
        GROUP BY r.inviter_id, u.username
        ORDER BY COUNT(*) DESC, MIN(r.counted_at) ASC
        LIMIT $2`,
      [id, contest.winners_count]
    );

    const winners: WinnerRow[] = leaders.map((row, i) => ({
      place: i + 1,
      user_id: Number(row.user_id),
      username: row.username,
      invites: Number(row.invites),
    }));

    for (const w of winners) {
      await client.query(
        `INSERT INTO contest_winners (contest_id, place, user_id, username, invites)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (contest_id, place) DO NOTHING`,
        [id, w.place, w.user_id, w.username, w.invites]
      );
    }

    await client.query(
      "UPDATE contests SET status = 'finished', finished_at = $2 WHERE id = $1",
      [id, nowSec()]
    );

    return winners;
  });
}

export async function getWinners(contestId: number): Promise<WinnerRow[]> {
  const { rows } = await pool.query<{
    place: number;
    user_id: string;
    username: string | null;
    invites: number;
  }>(
    "SELECT place, user_id, username, invites FROM contest_winners WHERE contest_id = $1 ORDER BY place",
    [contestId]
  );
  return rows.map((r) => ({
    place: Number(r.place),
    user_id: Number(r.user_id),
    username: r.username,
    invites: Number(r.invites),
  }));
}

// ───────────────────────────── Takliflar ─────────────────────────────

/**
 * Taklifni HISOBGA OLADI — taklif qilingan odam kanalga a'zo bo'lgach.
 *
 * `ON CONFLICT DO NOTHING` muhim: odam kanaldan chiqib qayta kirsa yoki
 * botni qayta ishga tushirsa, taklif IKKINCHI marta sanalmaydi. Busiz
 * reytingni cheksiz ko'tarish mumkin bo'lardi.
 *
 * `true` qaytsa — taklif AYNAN HOZIR hisobga olindi (taklif qilgan
 * odamga xabar berish uchun kerak).
 */
export async function countReferral(
  contestId: number,
  inviterId: number,
  invitedId: number
): Promise<boolean> {
  // O'zini o'zi taklif qilish mumkin emas.
  if (inviterId === invitedId) return false;

  const { rows } = await pool.query(
    `INSERT INTO contest_refs (contest_id, inviter_id, invited_id, counted_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (contest_id, invited_id) DO NOTHING
     RETURNING id`,
    [contestId, inviterId, invitedId, nowSec()]
  );
  return rows.length > 0;
}

/** Foydalanuvchining shu konkursdagi takliflari soni. */
export async function countUserInvites(contestId: number, userId: number): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM contest_refs WHERE contest_id = $1 AND inviter_id = $2",
    [contestId, userId]
  );
  return Number(rows[0]?.count ?? 0);
}

/**
 * Liderlar jadvali.
 *
 * Teng natijada OLDIN YETGAN yuqori turadi (`MIN(counted_at)`) — aks
 * holda tartib har so'rovda o'zgarib, jadval "sakrab" turardi.
 */
export async function getLeaders(contestId: number, limit = 10): Promise<LeaderRow[]> {
  const { rows } = await pool.query<{
    user_id: string;
    username: string | null;
    invites: string;
  }>(
    `SELECT r.inviter_id AS user_id, u.username, COUNT(*) AS invites
       FROM contest_refs r
       LEFT JOIN users u ON u.user_id = r.inviter_id
      WHERE r.contest_id = $1
      GROUP BY r.inviter_id, u.username
      ORDER BY COUNT(*) DESC, MIN(r.counted_at) ASC
      LIMIT $2`,
    [contestId, limit]
  );
  return rows.map((r) => ({
    user_id: Number(r.user_id),
    username: r.username,
    invites: Number(r.invites),
  }));
}

/**
 * Foydalanuvchining jadvaldagi o'rni (1 dan boshlab). Takliflari bo'lmasa 0.
 *
 * Tartib `getLeaders` BILAN BIR XIL bo'lishi shart, aks holda "siz
 * 5-o'rindasiz" deb turib, jadvalda boshqa joyda ko'rinardi.
 */
export async function getUserPlace(contestId: number, userId: number): Promise<number> {
  const { rows } = await pool.query<{ place: string }>(
    `WITH ranked AS (
       SELECT r.inviter_id,
              ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, MIN(r.counted_at) ASC) AS place
         FROM contest_refs r
        WHERE r.contest_id = $1
        GROUP BY r.inviter_id
     )
     SELECT place FROM ranked WHERE inviter_id = $2`,
    [contestId, userId]
  );
  return Number(rows[0]?.place ?? 0);
}

/** Konkursdagi umumiy ishtirokchilar va takliflar soni. */
export async function contestStats(
  contestId: number
): Promise<{ participants: number; invites: number }> {
  const { rows } = await pool.query<{ participants: string; invites: string }>(
    `SELECT COUNT(DISTINCT inviter_id) AS participants, COUNT(*) AS invites
       FROM contest_refs WHERE contest_id = $1`,
    [contestId]
  );
  return {
    participants: Number(rows[0]?.participants ?? 0),
    invites: Number(rows[0]?.invites ?? 0),
  };
}
