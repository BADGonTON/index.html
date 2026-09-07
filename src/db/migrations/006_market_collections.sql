-- 006_market_collections.sql
--
-- Katalog keshi endi HAR BIR KOLLEKSIYA uchun alohida qatorda saqlanadi.
--
-- Nega o'zgartirildi: avval butun katalog bitta JSONB qatorda edi. Marketapp
-- 429 (Too Many Requests) qaytarganda yiqilgan kolleksiyalar BO'SH ro'yxat
-- bilan saqlanardi va ishlaydigan ma'lumot o'chib ketardi — Mini App shu
-- sababli bo'm-bo'sh ko'rinardi. Endi har bir kolleksiya mustaqil: bittasi
-- yiqilsa, u shunchaki oxirgi muvaffaqiyatli holatida qoladi.

CREATE TABLE IF NOT EXISTS market_collections (
    address        TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    gifts          JSONB NOT NULL DEFAULT '[]'::jsonb,
    gift_count     INTEGER NOT NULL DEFAULT 0,
    -- Oxirgi MUVAFFAQIYATLI yangilanish. Aylanma yangilash eng eskisini
    -- birinchi navbatga oladi.
    fetched_at     BIGINT NOT NULL DEFAULT 0,
    -- Oxirgi urinishdagi xato (429 va h.k.). Muvaffaqiyatda NULL bo'ladi.
    last_error     TEXT,
    last_try_at    BIGINT NOT NULL DEFAULT 0,
    created_at     BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_market_collections_fetched ON market_collections (fetched_at);

-- Eski yagona-qatorli kesh endi ishlatilmaydi.
DROP TABLE IF EXISTS market_snapshot;
