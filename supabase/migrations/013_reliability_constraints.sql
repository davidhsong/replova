-- Consolidate accidental case-only account duplicates before normalizing.
-- Ownership is email-based (not account-id based), so restaurant rows remain
-- attached when the redundant account record is removed.
WITH grouped AS (
  SELECT
    lower(trim(owner_email)) AS normalized_email,
    (array_agg(id ORDER BY (stripe_customer_id IS NOT NULL) DESC, created_at ASC))[1] AS keeper_id,
    CASE
      WHEN bool_or(plan = 'agency') THEN 'agency'
      WHEN bool_or(plan = 'growth') THEN 'growth'
      ELSE 'starter'
    END AS best_plan,
    (array_agg(stripe_customer_id ORDER BY (stripe_customer_id IS NOT NULL) DESC, created_at ASC))[1] AS stripe_customer_id,
    max(terms_accepted_at) AS terms_accepted_at
  FROM accounts
  GROUP BY lower(trim(owner_email))
), updated AS (
  UPDATE accounts AS account
  SET
    plan = grouped.best_plan,
    stripe_customer_id = grouped.stripe_customer_id,
    terms_accepted_at = grouped.terms_accepted_at
  FROM grouped
  WHERE account.id = grouped.keeper_id
  RETURNING account.id
)
DELETE FROM accounts AS account
USING grouped
WHERE lower(trim(account.owner_email)) = grouped.normalized_email
  AND account.id <> grouped.keeper_id;

UPDATE accounts SET owner_email = lower(trim(owner_email));
UPDATE restaurants SET owner_email = lower(trim(owner_email));

CREATE UNIQUE INDEX IF NOT EXISTS accounts_owner_email_lower_unique
  ON accounts (lower(owner_email));

-- Places samples have no Google review resource name. Generate a stable key
-- from their identifying fields so concurrent syncs de-duplicate them without
-- collapsing two distinct GMB reviews that happened in the same second.
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS places_dedupe_key text
  GENERATED ALWAYS AS (
    CASE WHEN google_review_name IS NULL THEN
      md5(coalesce(author, '') || chr(31) || coalesce(review_timestamp::text, '') || chr(31) || coalesce(review_text, ''))
    ELSE NULL END
  ) STORED;

WITH duplicates AS (
  SELECT id, row_number() OVER (
    PARTITION BY restaurant_id, places_dedupe_key
    ORDER BY
      (status = 'replied') DESC,
      (reply_draft_1 IS NOT NULL) DESC,
      created_at ASC
  ) AS row_number
  FROM reviews
  WHERE places_dedupe_key IS NOT NULL
)
DELETE FROM reviews
USING duplicates
WHERE reviews.id = duplicates.id
  AND duplicates.row_number > 1;

DROP INDEX IF EXISTS reviews_restaurant_timestamp_unique;
CREATE UNIQUE INDEX IF NOT EXISTS reviews_restaurant_places_key_unique
  ON reviews (restaurant_id, places_dedupe_key);

ALTER TABLE restaurant_settings
  DROP CONSTRAINT IF EXISTS restaurant_settings_auto_reply_delay_hours_check;
UPDATE restaurant_settings
SET auto_reply_delay_hours = greatest(1, least(24, coalesce(auto_reply_delay_hours, 2)));
ALTER TABLE restaurant_settings
  ADD CONSTRAINT restaurant_settings_auto_reply_delay_hours_check
  CHECK (auto_reply_delay_hours BETWEEN 1 AND 24);

ALTER TABLE restaurant_settings
  DROP CONSTRAINT IF EXISTS restaurant_settings_negative_threshold_check;
UPDATE restaurant_settings
SET negative_threshold = greatest(1, least(5, coalesce(negative_threshold, 3)));
ALTER TABLE restaurant_settings
  ADD CONSTRAINT restaurant_settings_negative_threshold_check
  CHECK (negative_threshold BETWEEN 1 AND 5);

-- Claim due replies atomically so overlapping cron deliveries cannot post the
-- same Google reply twice. Stale claims are recoverable after 20 minutes.
ALTER TABLE reply_queue
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

CREATE OR REPLACE FUNCTION claim_due_replies(batch_size int DEFAULT 50)
RETURNS SETOF reply_queue
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH due AS (
    SELECT id
    FROM reply_queue
    WHERE sent = false
      AND (approved IS NULL OR approved = true)
      AND scheduled_send_at <= now()
      AND (processing_started_at IS NULL OR processing_started_at < now() - interval '20 minutes')
    ORDER BY scheduled_send_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(1, least(batch_size, 100))
  ), claimed AS (
    UPDATE reply_queue AS queue
    SET processing_started_at = now()
    FROM due
    WHERE queue.id = due.id
    RETURNING queue.*
  )
  SELECT * FROM claimed;
$$;
REVOKE ALL ON FUNCTION claim_due_replies(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_due_replies(int) TO service_role;

-- One delivery record per restaurant/week prevents duplicate weekly emails if
-- the scheduler delivers the same cron event more than once.
CREATE TABLE IF NOT EXISTS digest_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, week_start)
);
ALTER TABLE digest_deliveries ENABLE ROW LEVEL SECURITY;

-- Budget counters are also server-only. Older migrations created this
-- SECURITY DEFINER function with PostgreSQL's default PUBLIC execute grant.
REVOKE ALL ON FUNCTION increment_api_spend(float) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_api_spend(float) TO service_role;
