-- 005_ledger_sessions.sql
-- 1) Pul harakatlarining o'zgarmas tarixi (audit).
-- 2) Sessiyani PostgreSQL'ga ko'chirish — shundagina botni bir nechta
--    process/serverga tarqatish mumkin bo'ladi (RAM-dagi sessiya bunga xalaqit berardi).

CREATE TABLE IF NOT EXISTS balance_ledger (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT   NOT NULL,
    delta       BIGINT   NOT NULL,   -- + kirim, - chiqim (so'mda)
    balance_after BIGINT NOT NULL,
    reason      TEXT     NOT NULL,   -- 'topup' | 'stars' | 'premium' | 'rent' | 'rent_extend' | 'refund' | 'admin' | 'referral' | 'tg_profile'
    ref_id      TEXT,                -- tegishli yozuv IDsi (rental_id, tx_id, unique_sum, ...)
    created_at  BIGINT   NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_user ON balance_ledger (user_id, id DESC);

CREATE TABLE IF NOT EXISTS bot_sessions (
    key         TEXT PRIMARY KEY,
    value       JSONB NOT NULL,
    updated_at  BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bot_sessions_updated ON bot_sessions (updated_at);

-- To'lov oynasining tugashini endi setTimeout emas, fon ishchisi kuzatadi —
-- shunda bot qayta ishga tushsa ham "osilib qolgan" to'lov qolmaydi.
CREATE INDEX IF NOT EXISTS idx_payments_pending_created
    ON payments (created_at) WHERE status = 'pending';

-- Katta bazada "SELECT COUNT(*) FROM users" sekinlashadi; broadcast uchun
-- foydalanuvchilarni sahifalab o'qiymiz.
CREATE INDEX IF NOT EXISTS idx_users_id ON users (user_id);
