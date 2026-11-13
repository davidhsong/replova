-- Recruiting access is stored server-side so production authorization does
-- not depend exclusively on hosting-provider environment configuration.
CREATE TABLE IF NOT EXISTS career_admins (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

ALTER TABLE career_admins ENABLE ROW LEVEL SECURITY;

-- Only service-role server code reads or changes this allowlist.
