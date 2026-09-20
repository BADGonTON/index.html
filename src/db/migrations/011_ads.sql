-- 011_ads.sql
-- Telegram Ads bo'limi.
--
-- Telegram tomonda REKLAMA BERUVCHI HISOBI BITTA — bizniki. Foydalanuvchilar
-- o'z reklamalarini shu hisob ichida yaratadi. Telegram "bu reklama kimniki"
-- degan tushunchani bilmaydi, shuning uchun egalikni BIZ yuritamiz: har bir
-- `ads` qatori bitta foydalanuvchiga tegishli.
--
-- Pul yo'li: foydalanuvchi so'mda to'laydi (mavjud balansidan) → biz TON ga
-- o'giramiz → Telegram byudjetiga qo'yamiz. Har bir harakat `ad_topups` da
-- qoladi, shu sabab "pul qayerga ketdi" savoliga har doim javob bor.

CREATE TABLE IF NOT EXISTS ads (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT      NOT NULL,

    -- Telegram tomonidagi identifikator. Reklama Telegramda yaratilgunga
    -- qadar NULL bo'ladi (biz avval bazaga yozamiz, keyin API ga boramiz —
    -- shunda tarmoq uzilsa ham yozuv yo'qolmaydi).
    tg_ad_id        BIGINT UNIQUE,

    title           TEXT        NOT NULL,
    text            TEXT        NOT NULL DEFAULT '',
    promote_url     TEXT        NOT NULL DEFAULT '',
    placement       TEXT        NOT NULL DEFAULT 'channel_post',

    -- Telegram bergan holat: stopped / ready_for_review / in_review /
    -- declined / active / on_hold. `draft` — bizniki: hali yuborilmagan.
    status          TEXT        NOT NULL DEFAULT 'draft',
    decline_reason  TEXT,

    -- Telegramdan olingan oxirgi ko'rsatkichlar (keshi). Foydalanuvchi
    -- ro'yxatni ochganda API kutib turmasligi uchun shu yerda saqlanadi.
    cpm_ton         NUMERIC(20, 5) NOT NULL DEFAULT 0,
    budget_ton      NUMERIC(20, 5) NOT NULL DEFAULT 0,
    spent_ton       NUMERIC(20, 5) NOT NULL DEFAULT 0,
    views           BIGINT      NOT NULL DEFAULT 0,
    clicks          BIGINT      NOT NULL DEFAULT 0,
    actions         BIGINT      NOT NULL DEFAULT 0,

    error_msg       TEXT,
    created_at      BIGINT      NOT NULL,
    synced_at       BIGINT      NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ads_user ON ads (user_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_ads_sync ON ads (synced_at)
    WHERE tg_ad_id IS NOT NULL;

-- Har bir byudjet harakati: reklama yaratish yoki byudjetni oshirish.
--
-- `idempotency_key` Telegramga ham yuboriladi: tarmoq uzilib biz qayta
-- urinsak, Telegram avvalgi javobni qaytaradi va pul IKKI MARTA yechilmaydi.
CREATE TABLE IF NOT EXISTS ad_topups (
    id              BIGSERIAL PRIMARY KEY,
    -- `SET NULL`, `CASCADE` EMAS.
    --
    -- Reklama o'chirilganda (yoki yaratish yiqilib, qoralama olib
    -- tashlanganda) TO'LOV YOZUVI QOLISHI SHART: bu moliyaviy iz va
    -- "pul qayerga ketdi" savoliga javob beradi. Cascade uni reklama
    -- bilan birga o'chirib yuborardi.
    ad_id           BIGINT      REFERENCES ads (id) ON DELETE SET NULL,
    user_id         BIGINT      NOT NULL,

    uzs             BIGINT      NOT NULL,          -- foydalanuvchidan yechildi
    ton             NUMERIC(20, 5) NOT NULL,       -- Telegram byudjetiga qo'yildi
    fee_uzs         BIGINT      NOT NULL DEFAULT 0,-- bizning ustamamiz

    idempotency_key TEXT        NOT NULL UNIQUE,
    status          TEXT        NOT NULL DEFAULT 'pending',
    error_msg       TEXT,
    created_at      BIGINT      NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ad_topups_user ON ad_topups (user_id, id DESC);

-- Sozlamalar. Narx admin panelidan o'zgaradi, kod yangilash shart emas.
--
--   ads_markup_pct   — byudjet ustiga qo'shiladigan xizmat haqi (%)
--   ads_min_topup    — eng kam to'ldirish summasi (so'm)
INSERT INTO settings (key, value) VALUES ('ads_markup_pct', '15')
    ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('ads_min_topup', '50000')
    ON CONFLICT (key) DO NOTHING;
