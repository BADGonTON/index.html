import type { StorageAdapter } from "grammy";
import { pool } from "../pool";

/**
 * grammY sessiyasini PostgreSQL'da saqlaydi.
 *
 * Nega RAM emas? RAM-dagi sessiya bitta process bilan cheklaydi: botni
 * ikkinchi serverga/processga qo'shsangiz, foydalanuvchi bir so'rovda bir
 * processga, keyingisida boshqasiga tushib, FSM bosqichi "yo'qoladi".
 * Bazadagi sessiya bilan istalgancha instance qo'shish mumkin — 100-200 ming
 * foydalanuvchiga chidashning asosiy sharti aynan shu.
 */
export function createPgSessionStorage<T>(): StorageAdapter<T> {
  return {
    async read(key: string): Promise<T | undefined> {
      const { rows } = await pool.query<{ value: T }>(
        "SELECT value FROM bot_sessions WHERE key = $1",
        [key]
      );
      return rows[0]?.value;
    },

    async write(key: string, value: T): Promise<void> {
      await pool.query(
        `INSERT INTO bot_sessions (key, value, updated_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
        [key, JSON.stringify(value), Math.floor(Date.now() / 1000)]
      );
    },

    async delete(key: string): Promise<void> {
      await pool.query("DELETE FROM bot_sessions WHERE key = $1", [key]);
    },
  };
}

/**
 * Eskirgan sessiyalarni tozalaydi. Sessiya — vaqtinchalik holat (qaysi
 * bosqichda turibdi), shuning uchun bir necha kundan keyin keraksiz.
 * Busiz jadval yillar davomida o'sib boradi.
 */
export async function pruneOldSessions(olderThanSec: number): Promise<number> {
  const threshold = Math.floor(Date.now() / 1000) - olderThanSec;
  const { rowCount } = await pool.query("DELETE FROM bot_sessions WHERE updated_at < $1", [threshold]);
  return rowCount ?? 0;
}

/**
 * Foydalanuvchining "oxirgi bot xabari" belgisini o'chiradi.
 *
 * Bot fon jarayonidan (masalan to'lov kanalidan) foydalanuvchiga xabar
 * yuborganda chaqiriladi. Bunday xabar sessiyadan tashqarida ketadi,
 * ya'ni sessiyada eslab qolingan xabar endi chatning oxirgisi EMAS.
 * Belgi tozalanmasa, bot keyingi javobini o'sha eski xabarni tahrirlab
 * yozardi — foydalanuvchi esa ekranning pastida hech narsa ko'rmasdi.
 *
 * Sessiya butunlay o'chirilmaydi: FSM bosqichi va oferta roziligi joyida
 * qoladi, faqat bitta maydon olib tashlanadi.
 */
export async function clearTrackedMessage(userId: number): Promise<void> {
  await pool
    .query("UPDATE bot_sessions SET value = value - 'lastBotMessageId' WHERE key = $1", [
      String(userId),
    ])
    .catch(() => {
      // Sessiya hali yaratilmagan bo'lishi mumkin — muhim emas.
    });
}
