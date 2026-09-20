-- 013_ads_fixes.sql
--
-- Uchta nosozlik.
--
-- 1. TO'XTATISH KO'RINMAYDI.
--    Telegram reklamada IKKITA alohida maydon bor: `status`
--    (in_review / active / declined ...) va `is_paused`. Biz faqat
--    birinchisini saqlar edik, shuning uchun to'xtatilgan reklama
--    ekranda baribir "Ko'rikda" bo'lib turardi va tugma yozuvi
--    o'zgarmasdi — foydalanuvchi "to'xtamadi" deb o'ylardi.
--
-- 2. O'CHIRILGAN REKLAMA RO'YXATDA QOLARDI.
--    Sarflanmagan pulni qaytarish uchun Telegram reklamani 10 daqiqa
--    to'xtagan holda ushlab turishni talab qiladi, shuning uchun yozuv
--    darhol o'chmasdi. Foydalanuvchi uchun esa u "o'chmadi" edi.
--    Endi ro'yxatdan DARHOL yashiriladi, pul esa fonda qaytaveradi.
--
-- 3. ENG KAM SUMMA NOTO'G'RI EDI.
--    Telegram reklama ochish uchun kamida 1 TON talab qiladi (rasmiy
--    interfeysdagi "Initial budget in Gram: 1.00"). Bizda 0.1 turardi
--    va reklama yaratilmasdi.

ALTER TABLE ads ADD COLUMN IF NOT EXISTS is_paused BOOLEAN NOT NULL DEFAULT FALSE;

-- Ro'yxatdan yashirilgan vaqt. 0 — ko'rinadi.
-- Yozuvning o'zi qolaveradi: pul qaytarish tugaguncha u kerak.
ALTER TABLE ads ADD COLUMN IF NOT EXISTS hidden_at BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ads_user_visible ON ads (user_id, id DESC)
    WHERE hidden_at = 0;

-- Eng kam summani 1 TON ga ko'taramiz — LEKIN faqat eski noto'g'ri
-- qiymat turgan bo'lsa. Admin ataylab boshqa son qo'ygan bo'lsa,
-- uning tanloviga tegilmaydi.
UPDATE settings SET value = '1' WHERE key = 'ads_min_ton' AND value = '0.1';
INSERT INTO settings (key, value) VALUES ('ads_min_ton', '1')
    ON CONFLICT (key) DO NOTHING;
