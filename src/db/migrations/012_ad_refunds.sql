-- 012_ad_refunds.sql
-- Sarflanmagan byudjetni qaytarish.
--
-- Muammo: foydalanuvchi reklamaga 50 000 so'm qo'ydi, Telegram uni rad etdi
-- (yoki foydalanuvchi o'zi o'chirdi) — pul esa Telegram tomonda, reklama
-- byudjetida qolib ketardi. Sarflanmagan bo'lsa, u foydalanuvchiniki.
--
-- Nega DARHOL qaytarib bo'lmaydi: Telegram `decreaseAdBudget` va `deleteAd`
-- uchun reklama KAMIDA 10 DAQIQA to'xtagan bo'lishini talab qiladi. Shuning
-- uchun qaytarish navbatga qo'yiladi va fon ishchisi uni keyinroq bajaradi.

-- Qaytarish holati:
--   none    — kerak emas
--   pending — navbatda, `refund_after` vaqtidan keyin urinamiz
--   done    — qaytarildi
--   failed  — qayta-qayta urinib bo'lmadi (adminlar xabardor qilinadi)
ALTER TABLE ads ADD COLUMN IF NOT EXISTS refund_state  TEXT   NOT NULL DEFAULT 'none';

-- Shu vaqtdan oldin urinmaymiz (Telegramning 10 daqiqalik talabi).
ALTER TABLE ads ADD COLUMN IF NOT EXISTS refund_after  BIGINT NOT NULL DEFAULT 0;

-- Qaytargandan KEYIN reklamani butunlay o'chirish kerakmi.
-- Foydalanuvchi "o'chirish" bosganda TRUE bo'ladi: avval pulni olamiz,
-- keyin o'chiramiz — teskarisi bo'lsa pul Telegramda qolib ketardi.
ALTER TABLE ads ADD COLUMN IF NOT EXISTS delete_after_refund BOOLEAN NOT NULL DEFAULT FALSE;

-- Haqiqatan qaytarilgan miqdor (hisobot uchun).
ALTER TABLE ads ADD COLUMN IF NOT EXISTS refunded_ton NUMERIC(20, 5) NOT NULL DEFAULT 0;

-- Nechta marta urinilgani — cheksiz aylanishni to'xtatish uchun.
ALTER TABLE ads ADD COLUMN IF NOT EXISTS refund_tries INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ads_refund ON ads (refund_after)
    WHERE refund_state = 'pending';

-- Eng kam summa endi TON da saqlanadi (kurs o'zgarganda chegara
-- Telegramning talabidan pastga tushib qolmasligi uchun).
INSERT INTO settings (key, value) VALUES ('ads_min_ton', '0.1')
    ON CONFLICT (key) DO NOTHING;

-- Eng kam CPM asosi. Rasm, video va premium emoji qo'shilganda
-- avtomatik oshadi (hujjatdagi foizlar bo'yicha).
INSERT INTO settings (key, value) VALUES ('ads_min_cpm_ton', '0.1')
    ON CONFLICT (key) DO NOTHING;
