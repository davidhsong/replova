-- Base tables required by every later Replova migration.
-- This file is intentionally idempotent so it is safe for databases that
-- were originally bootstrapped with the legacy root-level schema script.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  place_id text NOT NULL UNIQUE,
  owner_email text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  stripe_customer_id text,
  google_access_token text,
  google_refresh_token text,
  google_token_expires_at bigint,
  google_location_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  author text,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  review_text text,
  review_timestamp bigint,
  reply_draft_1 text,
  reply_draft_2 text,
  reply_draft_3 text,
  status text NOT NULL DEFAULT 'pending',
  google_review_name text,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
