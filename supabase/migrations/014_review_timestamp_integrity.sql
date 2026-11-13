-- The legacy bootstrap schema made (restaurant_id, review_timestamp) unique.
-- Google can legitimately return two reviews with the same second-level
-- timestamp, so identity is now handled by google_review_name or the generated
-- places_dedupe_key from migration 013 instead.
ALTER TABLE reviews
  DROP CONSTRAINT IF EXISTS reviews_restaurant_id_review_timestamp_key;

DROP INDEX IF EXISTS reviews_restaurant_timestamp_unique;
