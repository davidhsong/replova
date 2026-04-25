-- Adds subscription plan tier to restaurants table
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'starter';

ALTER TABLE restaurants
  DROP CONSTRAINT IF EXISTS restaurants_plan_check;

ALTER TABLE restaurants
  ADD CONSTRAINT restaurants_plan_check
    CHECK (plan IN ('starter', 'growth', 'agency'));
