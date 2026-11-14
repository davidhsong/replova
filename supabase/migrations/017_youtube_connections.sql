-- Apply manually after configuring YOUTUBE_TOKEN_ENCRYPTION_KEY.
-- OAuth tokens are encrypted by the application before they reach this table.

CREATE TABLE IF NOT EXISTS youtube_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  channel_title text,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text NOT NULL,
  token_expires_at bigint NOT NULL,
  granted_scopes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE youtube_connections ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE youtube_connections IS
  'Server-only YouTube OAuth connections. No client RLS policies are intentionally defined.';
