-- 007_bundles.sql
-- To'plam (kolleksiya) xaridi: 3/6/9/12 ta gift bitta to'lovda olinadi.
-- Har bir gift baribir ALOHIDA ijara yozuvi bo'ladi (blokcheyn ishi ham
-- alohida ketadi), lekin ular bitta `bundle_id` bilan bog'lanadi —
-- shunda "Mening giftlarim" ularni bitta to'plam sifatida ko'rsata oladi.

ALTER TABLE rentals ADD COLUMN IF NOT EXISTS bundle_id    TEXT;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS bundle_label TEXT;

CREATE INDEX IF NOT EXISTS idx_rentals_bundle ON rentals (user_id, bundle_id)
    WHERE bundle_id IS NOT NULL;
