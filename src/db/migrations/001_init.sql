-- 001_init.sql
-- Boshlang'ich sxema: sozlamalar, foydalanuvchilar, to'lovlar, navbatdagi
-- tranzaksiyalar va buyurtmalar arxivi.

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
);

INSERT INTO settings (key, value)
VALUES ('star_price', '240')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS users (
    user_id      BIGINT PRIMARY KEY,
    username     TEXT,
    balance      BIGINT NOT NULL DEFAULT 0,
    referrer_id  BIGINT,
    ref_earned   BIGINT NOT NULL DEFAULT 0,
    banned_until BIGINT NOT NULL DEFAULT 0,
    created_at   BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payments (
    unique_sum BIGINT PRIMARY KEY,
    user_id    BIGINT NOT NULL,
    amount     BIGINT NOT NULL,
    status     TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    post_link  TEXT
);

CREATE INDEX IF NOT EXISTS idx_payments_user_status ON payments (user_id, status);

-- status: 'pending' | 'sending' | 'done' | 'failed'
CREATE TABLE IF NOT EXISTS pending_txs (
    id         SERIAL PRIMARY KEY,
    type       TEXT NOT NULL,
    data_json  TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'pending',
    retries    INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    error_msg  TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_txs_status ON pending_txs (status);

CREATE TABLE IF NOT EXISTS orders (
    id                 SERIAL PRIMARY KEY,
    type               TEXT,
    buyer_id           BIGINT,
    buyer_username     TEXT,
    recipient_username TEXT,
    quantity           INTEGER,
    months             INTEGER,
    ton                NUMERIC,
    uzs                BIGINT,
    status             TEXT,
    created_at         TEXT
);
