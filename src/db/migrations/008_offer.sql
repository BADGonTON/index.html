-- 008_offer.sql
-- Ommaviy ofertaga rozilik.
--
-- Telegram Stars va akkaunt savdosi bilan shug'ullanadigan botlar
-- foydalanuvchidan rozilik olishi kerak. Bot rozilik berilmaguncha
-- hech qanday bo'limni ochmaydi, shu sabab rozilik VAQTI saqlanadi —
-- keyinchalik "qachon rozi bo'lgan" degan savolga javob bor.

ALTER TABLE users ADD COLUMN IF NOT EXISTS offer_accepted_at BIGINT;

CREATE INDEX IF NOT EXISTS idx_users_offer ON users (offer_accepted_at)
    WHERE offer_accepted_at IS NULL;
