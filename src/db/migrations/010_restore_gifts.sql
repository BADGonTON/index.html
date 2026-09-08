-- 010_restore_gifts.sql
-- 002 dagi 11 ta sovg'ani QAYTARADI.
--
-- Nega kerak: 009 ning birinchi versiyasi ularni o'chirib yuborardi — ular
-- Telegram'ning "mavjud sovg'alar" ro'yxatida yo'qligi uchun eskirgan deb
-- hisoblangan edi. Bu noto'g'ri: `sendGift` gift ID bilan ishlaydi, ro'yxat
-- bilan emas, ya'ni bazadagi gift ro'yxatda bo'lmasa ham sotiladi.
--
-- Agar 009 allaqachon qo'llanilgan bo'lsa, bu migratsiya o'chirilganlarni
-- joyiga qaytaradi. Qo'llanmagan bo'lsa — hech narsa o'zgarmaydi (ular
-- allaqachon bor). Ikkala holatda ham natija bir xil: 22 ta gift.

INSERT INTO gifts (id, star_count, emoji, premium_id, active) VALUES
    ('6046178578163303744', 50, '🎁', '5470129614439362117', TRUE),
    ('5974210632977745012', 50, '🎁', '5397971251878732060', TRUE),
    ('6026193266406327981', 50, '🎁', '5447213743417105726', TRUE),
    ('5969796561943660080', 50, '🎁', '5393309541620291208', TRUE),
    ('5935895822435615975', 50, '🎁', '5359736160224586485', TRUE),
    ('5893356958802511476', 50, '🎁', '5317000922096769303', TRUE),
    ('5866352046986232958', 50, '🎁', '5289761157173775507', TRUE),
    ('5956217000635139069', 50, '🎁', '5379850840691476775', TRUE),
    ('5922558454332916696', 50, '🎄', '5345935030143196497', TRUE),
    ('5801108895304779062', 50, '🎁', '5224628072619216265', TRUE),
    ('5800655655995968830', 50, '🎁', '5226661632259691727', TRUE)
ON CONFLICT (id) DO UPDATE SET
    emoji      = EXCLUDED.emoji,
    premium_id = EXCLUDED.premium_id,
    active     = TRUE;
