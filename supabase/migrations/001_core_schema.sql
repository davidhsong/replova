-- =============================================================
-- Replova – core schema migration
-- Extends existing `restaurants` and `reviews` tables.
-- Creates: restaurant_settings, reply_queue, reputation_scores,
--          review_requests, competitors, competitor_snapshots
-- NOTE: All app queries use the service-role key (bypasses RLS).
--       RLS policies below are defensive / future-proofing.
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Extend existing `reviews` table with analysis columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS sentiment_score    float,           -- -1.0 to 1.0
  ADD COLUMN IF NOT EXISTS sentiment_label    text,            -- 'positive' | 'neutral' | 'negative'
  ADD COLUMN IF NOT EXISTS sentiment_summary  text,            -- 1-sentence AI summary
  ADD COLUMN IF NOT EXISTS keywords           text[],          -- extracted topics
  ADD COLUMN IF NOT EXISTS staff_mentions     text[],          -- staff names mentioned
  ADD COLUMN IF NOT EXISTS menu_mentions      text[];          -- food/menu items mentioned


-- ─────────────────────────────────────────────────────────────
-- 2. restaurant_settings — per-restaurant configuration
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restaurant_settings (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id             uuid        REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL UNIQUE,
  auto_reply_enabled        boolean     DEFAULT false,
  auto_reply_delay_hours    int         DEFAULT 2,
  reply_persona             text,
  notify_negative_reviews   boolean     DEFAULT true,
  negative_threshold        int         DEFAULT 3,   -- star rating that triggers alert
  digest_enabled            boolean     DEFAULT true,
  digest_day                int         DEFAULT 1,   -- 0=Sun … 6=Sat
  recovery_offer_enabled    boolean     DEFAULT false,
  recovery_offer_text       text,
  created_at                timestamptz DEFAULT now()
);


-- ─────────────────────────────────────────────────────────────
-- 3. reply_queue — outbox for AI replies awaiting send/approval
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reply_queue (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id           uuid        REFERENCES reviews(id) ON DELETE CASCADE NOT NULL,
  restaurant_id       uuid        REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  generated_reply     text        NOT NULL,
  edited_reply        text,
  scheduled_send_at   timestamptz,
  sent                boolean     DEFAULT false,
  sent_at             timestamptz,
  approved            boolean,    -- NULL=pending, true=approved, false=rejected
  created_at          timestamptz DEFAULT now()
);


-- ─────────────────────────────────────────────────────────────
-- 4. reputation_scores — daily composite score snapshots
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reputation_scores (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id       uuid    REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  score               float,  -- 0–100 composite Replova score
  avg_rating          float,
  total_reviews       int,
  reviews_this_month  int,
  response_rate       float,  -- 0–1
  avg_sentiment       float,
  score_date          date    DEFAULT current_date,
  created_at          timestamptz DEFAULT now(),
  UNIQUE (restaurant_id, score_date)
);


-- ─────────────────────────────────────────────────────────────
-- 5. review_requests — outbound review solicitation campaigns
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_requests (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid        REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  customer_name   text,
  customer_email  text,
  customer_phone  text,
  channel         text        DEFAULT 'email',    -- 'email' | 'sms'
  status          text        DEFAULT 'pending',  -- 'pending' | 'sent' | 'opened' | 'clicked'
  sent_at         timestamptz,
  opened_at       timestamptz,
  clicked_at      timestamptz,
  review_link     text,
  created_at      timestamptz DEFAULT now()
);


-- ─────────────────────────────────────────────────────────────
-- 6. competitors — restaurants being tracked for benchmarking
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS competitors (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid    REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  name            text    NOT NULL,
  google_place_id text    NOT NULL,
  address         text,
  active          boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (restaurant_id, google_place_id)
);


-- ─────────────────────────────────────────────────────────────
-- 7. competitor_snapshots — daily rating / review-count history
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS competitor_snapshots (
  id              uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id   uuid  REFERENCES competitors(id) ON DELETE CASCADE NOT NULL,
  avg_rating      float,
  total_reviews   int,
  snapshot_date   date  DEFAULT current_date,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (competitor_id, snapshot_date)
);


-- ─────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_date
  ON reviews (restaurant_id, review_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_rating
  ON reviews (restaurant_id, rating);

CREATE INDEX IF NOT EXISTS idx_reviews_google_review_name
  ON reviews (google_review_name);

CREATE INDEX IF NOT EXISTS idx_reply_queue_restaurant_sent
  ON reply_queue (restaurant_id, sent, scheduled_send_at);

CREATE INDEX IF NOT EXISTS idx_reputation_scores_restaurant_date
  ON reputation_scores (restaurant_id, score_date DESC);

CREATE INDEX IF NOT EXISTS idx_review_requests_restaurant_status
  ON review_requests (restaurant_id, status);


-- ─────────────────────────────────────────────────────────────
-- RLS — enable on all new tables
-- (existing `restaurants` and `reviews` have no RLS; all queries
--  currently go through the service-role key which bypasses RLS)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE restaurant_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_queue            ENABLE ROW LEVEL SECURITY;
ALTER TABLE reputation_scores      ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors            ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_snapshots   ENABLE ROW LEVEL SECURITY;


-- Helper: returns true when the calling user owns the given restaurant.
-- Uses owner_email because `restaurants` has no user_id FK.
CREATE OR REPLACE FUNCTION owns_restaurant(rid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM restaurants
    WHERE id = rid
      AND owner_email = auth.email()
  )
$$;


-- restaurant_settings
CREATE POLICY "owner select"   ON restaurant_settings FOR SELECT USING (owns_restaurant(restaurant_id));
CREATE POLICY "owner insert"   ON restaurant_settings FOR INSERT WITH CHECK (owns_restaurant(restaurant_id));
CREATE POLICY "owner update"   ON restaurant_settings FOR UPDATE USING (owns_restaurant(restaurant_id));
CREATE POLICY "owner delete"   ON restaurant_settings FOR DELETE USING (owns_restaurant(restaurant_id));

-- reply_queue
CREATE POLICY "owner select"   ON reply_queue FOR SELECT USING (owns_restaurant(restaurant_id));
CREATE POLICY "owner insert"   ON reply_queue FOR INSERT WITH CHECK (owns_restaurant(restaurant_id));
CREATE POLICY "owner update"   ON reply_queue FOR UPDATE USING (owns_restaurant(restaurant_id));
CREATE POLICY "owner delete"   ON reply_queue FOR DELETE USING (owns_restaurant(restaurant_id));

-- reputation_scores
CREATE POLICY "owner select"   ON reputation_scores FOR SELECT USING (owns_restaurant(restaurant_id));
CREATE POLICY "owner insert"   ON reputation_scores FOR INSERT WITH CHECK (owns_restaurant(restaurant_id));
CREATE POLICY "owner update"   ON reputation_scores FOR UPDATE USING (owns_restaurant(restaurant_id));
CREATE POLICY "owner delete"   ON reputation_scores FOR DELETE USING (owns_restaurant(restaurant_id));

-- review_requests
CREATE POLICY "owner select"   ON review_requests FOR SELECT USING (owns_restaurant(restaurant_id));
CREATE POLICY "owner insert"   ON review_requests FOR INSERT WITH CHECK (owns_restaurant(restaurant_id));
CREATE POLICY "owner update"   ON review_requests FOR UPDATE USING (owns_restaurant(restaurant_id));
CREATE POLICY "owner delete"   ON review_requests FOR DELETE USING (owns_restaurant(restaurant_id));

-- competitors
CREATE POLICY "owner select"   ON competitors FOR SELECT USING (owns_restaurant(restaurant_id));
CREATE POLICY "owner insert"   ON competitors FOR INSERT WITH CHECK (owns_restaurant(restaurant_id));
CREATE POLICY "owner update"   ON competitors FOR UPDATE USING (owns_restaurant(restaurant_id));
CREATE POLICY "owner delete"   ON competitors FOR DELETE USING (owns_restaurant(restaurant_id));

-- competitor_snapshots (join through competitors → restaurants)
CREATE POLICY "owner select" ON competitor_snapshots FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM competitors c
    WHERE c.id = competitor_id AND owns_restaurant(c.restaurant_id)
  ));
CREATE POLICY "owner insert" ON competitor_snapshots FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM competitors c
    WHERE c.id = competitor_id AND owns_restaurant(c.restaurant_id)
  ));
CREATE POLICY "owner update" ON competitor_snapshots FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM competitors c
    WHERE c.id = competitor_id AND owns_restaurant(c.restaurant_id)
  ));
CREATE POLICY "owner delete" ON competitor_snapshots FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM competitors c
    WHERE c.id = competitor_id AND owns_restaurant(c.restaurant_id)
  ));
