-- 003_tg_accounts.sql
-- "Telegram profil" bo'limi uchun: admin qo'shgan tayyor Telegram akkauntlari
-- (telefon + StringSession + 2FA + narx) shu jadvalda saqlanadi.

CREATE TABLE IF NOT EXISTS tg_accounts (
    id              SERIAL PRIMARY KEY,
    phone           TEXT NOT NULL,
    session_string  TEXT NOT NULL,
    two_fa          TEXT,                 -- 2FA paroli, bo'lmasa NULL
    price           BIGINT NOT NULL DEFAULT 0,  -- shu akkaunt narxi (so'mda)
    status          TEXT NOT NULL DEFAULT 'available', -- available | pending | sold
    buyer_id        BIGINT,
    created_at      BIGINT NOT NULL,
    sold_at         BIGINT
);

CREATE INDEX IF NOT EXISTS idx_tg_accounts_status ON tg_accounts (status, id);
