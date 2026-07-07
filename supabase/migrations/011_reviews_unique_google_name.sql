-- Prevents duplicate review rows when a concurrent sync (manual "Sync now" +
-- the 6h cron, or two overlapping cron runs) both see the same Google review
-- as "new" and both insert it. The old idx_reviews_google_review_name index
-- was not unique and not scoped to restaurant_id, so nothing stopped the
-- double-insert.
--
-- Not partial on purpose: a standard unique index treats every NULL as
-- distinct from every other NULL, so legacy Places-API rows (which have no
-- google_review_name) are unaffected and can still coexist freely — only
-- rows that share both restaurant_id AND an actual google_review_name value
-- are constrained. This also lets a plain `ON CONFLICT (restaurant_id,
-- google_review_name)` clause infer this index (Postgres can't infer a
-- partial index unless the conflict clause repeats its WHERE predicate).
CREATE UNIQUE INDEX IF NOT EXISTS reviews_restaurant_google_name_unique
  ON reviews (restaurant_id, google_review_name);
