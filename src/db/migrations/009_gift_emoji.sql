-- 009_gift_emoji.sql
-- Gift katalogini tartibga solamiz.
--
-- MUAMMO: Telegram API'dan kelgan giftda premium emoji YO'Q.
--   Shuning uchun ular oddiy emoji bilan chiqardi. Endi har bir gift uchun
--   o'z premium emojisi bazada saqlanadi va API'dan kelgan gift shu ID bilan
--   mos kelsa, o'sha premium emoji ishlatiladi.

-- Yangi sovg'alar: gift ID → emoji + premium emoji ID.
--
-- Bular 002 dagi 11 taning USTIGA qo'shiladi (ularniki ham o'z premium
-- emojisi bilan bazada turibdi), ya'ni katalogda jami 22 ta gift bo'ladi.
--
-- `star_count` shu yerda ham turadi, lekin ROSTLOVCHI manba Telegram API:
-- narx o'zgarsa, ro'yxat API'dagi qiymatni oladi (src/bot/handlers/gifts.ts).
INSERT INTO gifts (id, star_count, emoji, premium_id, active) VALUES
    ('6028601630662853006',  50, '🍾', '5451905784734574339', TRUE),
    ('5170521118301225164', 100, '💎', '5280922999241859582', TRUE),
    ('5170690322832818290', 100, '💍', '5280651583078556009', TRUE),
    ('5168043875654172773', 100, '🏆', '5280769763398671636', TRUE),
    ('5170564780938756245',  50, '🚀', '5283080528818360566', TRUE),
    ('5170314324215857265',  50, '💐', '5280774333243873175', TRUE),
    ('5170144170496491616',  50, '🎂', '5280659198055572187', TRUE),
    ('5168103777563050263',  25, '🌹', '5280947338821524402', TRUE),
    ('5170250947678437525',  25, '🎁', '5280615440928758599', TRUE),
    ('5170233102089322756',  15, '🧸', '5280598054901145762', TRUE),
    ('5170145012310081615',  15, '💝', '5283228279988309088', TRUE)
ON CONFLICT (id) DO UPDATE SET
    star_count = EXCLUDED.star_count,
    emoji      = EXCLUDED.emoji,
    premium_id = EXCLUDED.premium_id,
    active     = TRUE;
