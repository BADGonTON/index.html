-- 002_gifts.sql
-- Gift katalogini bazaga ko'chiramiz, shunda admin panel orqali yangi gift
-- qo'shish/o'chirish/narxini o'zgartirish mumkin bo'ladi (kod o'zgartirmasdan).

CREATE TABLE IF NOT EXISTS gifts (
    id         TEXT PRIMARY KEY,       -- Fragment gift_id
    star_count INTEGER NOT NULL,       -- narxi (Stars miqdorida)
    emoji      TEXT NOT NULL DEFAULT '🎁',
    premium_id TEXT,                   -- ixtiyoriy: tg-emoji preview id
    title      TEXT,                   -- ixtiyoriy: ko'rinadigan nomi
    active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Boshlang'ich (eski statik ro'yxatdagi) sovg'alarni bir martalik seed qilamiz.
INSERT INTO gifts (id, star_count, emoji, premium_id) VALUES
    ('6046178578163303744', 50, '🎁', '5470129614439362117'),
    ('5974210632977745012', 50, '🎁', '5397971251878732060'),
    ('6026193266406327981', 50, '🎁', '5447213743417105726'),
    ('5969796561943660080', 50, '🎁', '5393309541620291208'),
    ('5935895822435615975', 50, '🎁', '5359736160224586485'),
    ('5893356958802511476', 50, '🎁', '5317000922096769303'),
    ('5866352046986232958', 50, '🎁', '5289761157173775507'),
    ('5956217000635139069', 50, '🎁', '5379850840691476775'),
    ('5922558454332916696', 50, '🎄', '5345935030143196497'),
    ('5801108895304779062', 50, '🎁', '5224628072619216265'),
    ('5800655655995968830', 50, '🎁', '5226661632259691727')
ON CONFLICT (id) DO NOTHING;
