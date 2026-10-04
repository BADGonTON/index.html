-- 014_contest.sql
-- Referal konkursi.
--
-- Qoida sodda: kim ko'proq odam taklif qilsa, o'sha yutadi. Lekin
-- "taklif qilish" degani havolani bosish EMAS — taklif qilingan odam
-- kanalga A'ZO BO'LGANDAN KEYIN sanaladi. Aks holda konkurs soxta
-- akkauntlar bilan to'lib ketadi.
--
-- Shuning uchun taklif `users.referrer_id` dan ALOHIDA yoziladi: u yerda
-- "kim kimni chaqirgan" turadi, bu yerda esa "kim HISOBGA olingan".

CREATE TABLE IF NOT EXISTS contests (
    id            BIGSERIAL PRIMARY KEY,
    title         TEXT    NOT NULL,
    prize         TEXT    NOT NULL DEFAULT '',

    -- Nechta o'rin sovrinli.
    winners_count INTEGER NOT NULL DEFAULT 3,

    -- active — davom etmoqda, finished — yakunlangan.
    status        TEXT    NOT NULL DEFAULT 'active',

    started_at    BIGINT  NOT NULL,
    finished_at   BIGINT
);

-- Bir vaqtda faqat BITTA konkurs faol bo'lishi mumkin.
--
-- Ikkitasi faol bo'lsa, taklif qaysi biriga yozilishi noaniq bo'lardi va
-- liderlar jadvali aralashib ketardi. Bazaning o'zi bunga yo'l qo'ymaydi.
CREATE UNIQUE INDEX IF NOT EXISTS idx_contest_one_active
    ON contests ((status)) WHERE status = 'active';

-- Hisobga olingan takliflar.
CREATE TABLE IF NOT EXISTS contest_refs (
    id          BIGSERIAL PRIMARY KEY,
    contest_id  BIGINT  NOT NULL REFERENCES contests (id) ON DELETE CASCADE,
    inviter_id  BIGINT  NOT NULL,
    invited_id  BIGINT  NOT NULL,
    counted_at  BIGINT  NOT NULL,

    -- BITTA ODAM BIR MARTA sanaladi.
    --
    -- Busiz: taklif qilingan odam kanaldan chiqib, qayta kirsa, taklif
    -- yana sanalardi — va shu yo'l bilan reytingni cheksiz ko'tarish
    -- mumkin bo'lardi.
    UNIQUE (contest_id, invited_id)
);

CREATE INDEX IF NOT EXISTS idx_contest_refs_inviter
    ON contest_refs (contest_id, inviter_id);

-- Yakunlangan konkursning g'oliblari.
--
-- Natija MUZLATILADI: yakunlangandan keyin kimdir yana odam taklif qilsa
-- ham, g'oliblar ro'yxati o'zgarmaydi.
CREATE TABLE IF NOT EXISTS contest_winners (
    contest_id BIGINT  NOT NULL REFERENCES contests (id) ON DELETE CASCADE,
    place      INTEGER NOT NULL,
    user_id    BIGINT  NOT NULL,
    username   TEXT,
    invites    INTEGER NOT NULL,
    PRIMARY KEY (contest_id, place)
);

-- Foydalanuvchi kanalga qachon a'zo bo'lgani.
--
-- Bir marta tekshirilgach shu yerga yoziladi: har bir xabarda Telegramga
-- so'rov yuborish botni sekinlashtirardi.
ALTER TABLE users ADD COLUMN IF NOT EXISTS channel_joined_at BIGINT NOT NULL DEFAULT 0;

-- Sozlamalar.
--
--   contest_channel      — majburiy kanal (@username yoki -100... ID)
--   contest_require_sub  — darvoza yoqilganmi ('1' / '0')
--   contest_channel_url  — "Kanalga o'tish" tugmasi uchun havola
INSERT INTO settings (key, value) VALUES ('contest_channel', '')
    ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('contest_require_sub', '0')
    ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('contest_channel_url', '')
    ON CONFLICT (key) DO NOTHING;
