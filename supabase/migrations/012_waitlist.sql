-- =============================================================
-- Waitlist — captures interested signups while the login/signup
-- and billing flows are temporarily offline.
-- =============================================================
CREATE TABLE IF NOT EXISTS waitlist (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text        NOT NULL UNIQUE,
  business_name   text,
  created_at      timestamptz DEFAULT now()
);

-- No RLS policies: only the service-role key (server-side API route) touches this table.
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
