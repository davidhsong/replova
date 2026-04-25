-- ─────────────────────────────────────────────────────────────
-- API budget tracking for development spend management
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_usage_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  model         text        NOT NULL,
  operation     text        NOT NULL,
  input_tokens  int         NOT NULL DEFAULT 0,
  output_tokens int         NOT NULL DEFAULT 0,
  cost_usd      float       NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_log_created
  ON api_usage_log (created_at DESC);

CREATE TABLE IF NOT EXISTS api_budget_state (
  id             text        PRIMARY KEY DEFAULT 'default',
  budget_usd     float       NOT NULL DEFAULT 20.0,
  spent_usd      float       NOT NULL DEFAULT 0.0,
  updated_at     timestamptz DEFAULT now()
);

-- Seed the single state row
INSERT INTO api_budget_state (id, budget_usd, spent_usd)
VALUES ('default', 20.0, 0.0)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Atomic increment + threshold detection in one round-trip.
-- Returns whether each alert threshold was JUST crossed
-- (previous spend was below, new spend is at/above).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_api_spend(amount float)
RETURNS TABLE(
  new_spent_usd  float,
  budget_usd     float,
  crossed_50     boolean,
  crossed_75     boolean,
  crossed_100    boolean
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_spent float;
  v_new_spent float;
  v_budget    float;
BEGIN
  SELECT s.spent_usd, s.budget_usd INTO v_old_spent, v_budget
  FROM api_budget_state s WHERE s.id = 'default';

  v_new_spent := v_old_spent + amount;

  UPDATE api_budget_state
  SET spent_usd  = v_new_spent,
      updated_at = now()
  WHERE id = 'default';

  RETURN QUERY SELECT
    v_new_spent,
    v_budget,
    (v_old_spent / NULLIF(v_budget, 0) < 0.50 AND v_new_spent / NULLIF(v_budget, 0) >= 0.50),
    (v_old_spent / NULLIF(v_budget, 0) < 0.75 AND v_new_spent / NULLIF(v_budget, 0) >= 0.75),
    (v_old_spent / NULLIF(v_budget, 0) < 1.00 AND v_new_spent / NULLIF(v_budget, 0) >= 1.00);
END;
$$;
