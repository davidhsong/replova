-- =============================================================
-- Replova – accounts table + multi-location migration
-- Moves plan and stripe_customer_id off restaurants onto a new
-- per-user accounts table.  Adds report_logo_url to restaurants.
-- Safe to re-run (idempotent).
-- =============================================================

-- 1. Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email        text        UNIQUE NOT NULL,
  plan               text        NOT NULL DEFAULT 'starter'
                                   CHECK (plan IN ('starter', 'growth', 'agency')),
  stripe_customer_id text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- 2. Seed one account row per distinct owner_email in restaurants,
--    carrying over plan/stripe_customer_id only if those columns still exist
--    (they may have already been dropped by a partial prior run).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'plan'
  ) THEN
    INSERT INTO accounts (owner_email, plan, stripe_customer_id)
    SELECT DISTINCT ON (owner_email)
      owner_email,
      COALESCE(plan, 'starter'),
      stripe_customer_id
    FROM restaurants
    ON CONFLICT (owner_email) DO NOTHING;
  ELSE
    INSERT INTO accounts (owner_email, plan, stripe_customer_id)
    SELECT DISTINCT ON (owner_email)
      owner_email,
      'starter',
      NULL
    FROM restaurants
    ON CONFLICT (owner_email) DO NOTHING;
  END IF;
END $$;

-- 3. Add report_logo_url column to restaurants (for Agency white-label reports)
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS report_logo_url text;

-- 4. Drop plan and stripe_customer_id from restaurants
--    (constraints on these columns are dropped automatically by PostgreSQL)
ALTER TABLE restaurants DROP COLUMN IF EXISTS plan;
ALTER TABLE restaurants DROP COLUMN IF EXISTS stripe_customer_id;

-- 5. Explicitly drop the plan check constraint in case it survives somehow
ALTER TABLE restaurants DROP CONSTRAINT IF EXISTS restaurants_plan_check;
