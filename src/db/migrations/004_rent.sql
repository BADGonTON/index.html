-- 004_rent.sql
-- "Gift Arenda" (Mini App) bo'limi. Avval alohida SQLite bazada edi —
-- endi asosiy PostgreSQL bazasiga ko'chirildi, shuning uchun foydalanuvchi
-- balansi Stars/Premium/Gift/Arenda uchun BITTA va yagona.

CREATE TABLE IF NOT EXISTS rentals (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT      NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
    nft_address         TEXT        NOT NULL,
    nft_name            TEXT        NOT NULL,
    collection_name     TEXT,
    collection_address  TEXT,

    duration_sec        BIGINT      NOT NULL,
    price_per_day_nano  NUMERIC(40, 0) NOT NULL,  -- nanoTON, katta son (aniqlik yo'qolmaydi)
    paid_uzs            BIGINT      NOT NULL DEFAULT 0,

    -- Holat mashinasi (faqat shu yo'nalishlarda o'zgaradi):
    --   draft  -> paying -> pending_link -> linked -> expired
    --   draft  -> paying -> failed  (pul qaytariladi)
    status              TEXT        NOT NULL DEFAULT 'draft',
    tonconnect_url      TEXT,
    tx_error            TEXT,
    end_time            BIGINT,
    created_at          BIGINT      NOT NULL,
    updated_at          BIGINT      NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rentals_user_status ON rentals (user_id, status, id DESC);
CREATE INDEX IF NOT EXISTS idx_rentals_status      ON rentals (status);
CREATE INDEX IF NOT EXISTS idx_rentals_end_time    ON rentals (end_time) WHERE status = 'linked';

-- Arenda bo'yicha blokcheyn ishlari ham navbatga tushadi (Stars/Premium kabi):
-- HTTP so'rov TON tasdiqlanishini KUTMAYDI, shu sabab Mini App bir zumda javob beradi.
CREATE TABLE IF NOT EXISTS rent_jobs (
    id          BIGSERIAL PRIMARY KEY,
    rental_id   BIGINT      NOT NULL REFERENCES rentals (id) ON DELETE CASCADE,
    kind        TEXT        NOT NULL,          -- 'pay' | 'extend'
    payload     JSONB       NOT NULL,          -- { days, extra_sec, cost_uzs }
    status      TEXT        NOT NULL DEFAULT 'pending', -- pending | sending | done | failed
    retries     INTEGER     NOT NULL DEFAULT 0,
    error_msg   TEXT,
    created_at  BIGINT      NOT NULL,
    updated_at  BIGINT      NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rent_jobs_pending ON rent_jobs (status, id) WHERE status = 'pending';

-- Marketapp katalogi keshi. Mini App HAR OCHILGANDA Marketapp'ga bormaydi —
-- fon ishchisi (marketRefresher) shu jadvalni yangilab turadi, Mini App esa
-- xotiradagi/nusxadagi keshdan bir zumda o'qiydi. Restartdan keyin ham
-- birinchi so'rovdanoq to'liq katalog tayyor bo'ladi.
CREATE TABLE IF NOT EXISTS market_snapshot (
    key         TEXT PRIMARY KEY,   -- 'catalog'
    payload     JSONB NOT NULL,
    fetched_at  BIGINT NOT NULL
);
