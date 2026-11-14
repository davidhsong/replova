-- Phase 4A durable sync/draft worker runtime state.
-- Apply manually after migration 022. This migration does not schedule workers
-- and does not create or call any publishing function.

CREATE TABLE IF NOT EXISTS youtube_automation_runtime (
  connection_id uuid PRIMARY KEY REFERENCES youtube_connections(id) ON DELETE CASCADE,
  sync_page_token text,
  sync_cycle_started_at timestamptz,
  last_sync_at timestamptz,
  last_draft_at timestamptz,
  lease_token uuid,
  leased_by text,
  leased_at timestamptz,
  lease_expires_at timestamptz,
  last_run_id uuid,
  last_error_code text,
  last_error_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT youtube_automation_runtime_lease_fields CHECK (
    (
      lease_token IS NULL AND leased_by IS NULL
      AND leased_at IS NULL AND lease_expires_at IS NULL
    ) OR (
      lease_token IS NOT NULL AND leased_by IS NOT NULL
      AND leased_at IS NOT NULL AND lease_expires_at IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS youtube_automation_runtime_claim
  ON youtube_automation_runtime (lease_expires_at, updated_at);

DROP TRIGGER IF EXISTS youtube_automation_runtime_updated_at ON youtube_automation_runtime;
CREATE TRIGGER youtube_automation_runtime_updated_at
BEFORE UPDATE ON youtube_automation_runtime
FOR EACH ROW EXECUTE FUNCTION set_youtube_automation_updated_at();

ALTER TABLE youtube_automation_runtime ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "youtube runtime owner select" ON youtube_automation_runtime;
CREATE POLICY "youtube runtime owner select"
  ON youtube_automation_runtime FOR SELECT
  TO authenticated USING (owns_youtube_connection(connection_id));

CREATE OR REPLACE FUNCTION claim_youtube_automation_connections(
  p_batch_size integer,
  p_worker_id text,
  p_lease_seconds integer,
  p_run_id uuid
)
RETURNS SETOF youtube_automation_runtime
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO youtube_automation_runtime (connection_id)
  SELECT settings.connection_id
  FROM youtube_automation_settings AS settings
  WHERE settings.automation_enabled = true
  ON CONFLICT (connection_id) DO NOTHING;

  RETURN QUERY
  WITH candidates AS (
    SELECT runtime.connection_id
    FROM youtube_automation_runtime AS runtime
    JOIN youtube_automation_settings AS settings
      ON settings.connection_id = runtime.connection_id
    WHERE settings.automation_enabled = true
      AND (
        runtime.lease_token IS NULL
        OR runtime.lease_expires_at IS NULL
        OR runtime.lease_expires_at < now()
      )
    ORDER BY runtime.updated_at ASC
    FOR UPDATE OF runtime SKIP LOCKED
    LIMIT greatest(1, least(p_batch_size, 100))
  )
  UPDATE youtube_automation_runtime AS runtime
  SET
    lease_token = gen_random_uuid(),
    leased_by = left(COALESCE(NULLIF(trim(p_worker_id), ''), 'youtube-worker'), 200),
    leased_at = now(),
    lease_expires_at = now() + make_interval(secs => greatest(30, least(p_lease_seconds, 900))),
    last_run_id = p_run_id,
    last_error_code = NULL,
    last_error_at = NULL
  FROM candidates
  WHERE runtime.connection_id = candidates.connection_id
  RETURNING runtime.*;
END;
$$;

CREATE OR REPLACE FUNCTION checkpoint_youtube_automation_sync(
  p_connection_id uuid,
  p_lease_token uuid,
  p_run_id uuid,
  p_next_page_token text,
  p_cycle_started_at timestamptz,
  p_cycle_complete boolean
)
RETURNS youtube_automation_runtime
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  runtime youtube_automation_runtime%ROWTYPE;
BEGIN
  IF p_cycle_complete IS NULL THEN
    RAISE EXCEPTION 'invalid_cycle_complete_flag';
  END IF;

  UPDATE youtube_automation_runtime
  SET
    sync_page_token = CASE WHEN p_cycle_complete THEN NULL ELSE NULLIF(p_next_page_token, '') END,
    sync_cycle_started_at = CASE WHEN p_cycle_complete THEN NULL ELSE p_cycle_started_at END,
    last_sync_at = now(),
    last_run_id = p_run_id
  WHERE connection_id = p_connection_id
    AND lease_token = p_lease_token
    AND lease_expires_at > now()
  RETURNING * INTO runtime;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'automation_lease_lost';
  END IF;
  IF NOT p_cycle_complete AND runtime.sync_page_token IS NULL THEN
    RAISE EXCEPTION 'missing_sync_checkpoint';
  END IF;

  RETURN runtime;
END;
$$;

CREATE OR REPLACE FUNCTION finish_youtube_automation_connection(
  p_connection_id uuid,
  p_lease_token uuid,
  p_run_id uuid,
  p_drafted boolean,
  p_error_code text
)
RETURNS youtube_automation_runtime
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  runtime youtube_automation_runtime%ROWTYPE;
BEGIN
  UPDATE youtube_automation_runtime
  SET
    last_draft_at = CASE WHEN p_drafted THEN now() ELSE last_draft_at END,
    lease_token = NULL,
    leased_by = NULL,
    leased_at = NULL,
    lease_expires_at = NULL,
    last_run_id = p_run_id,
    last_error_code = NULLIF(left(COALESCE(p_error_code, ''), 200), ''),
    last_error_at = CASE WHEN NULLIF(trim(COALESCE(p_error_code, '')), '') IS NULL THEN NULL ELSE now() END
  WHERE connection_id = p_connection_id
    AND lease_token = p_lease_token
  RETURNING * INTO runtime;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'automation_lease_lost';
  END IF;
  RETURN runtime;
END;
$$;

REVOKE ALL ON FUNCTION claim_youtube_automation_connections(integer, text, integer, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION checkpoint_youtube_automation_sync(uuid, uuid, uuid, text, timestamptz, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION finish_youtube_automation_connection(uuid, uuid, uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_youtube_automation_connections(integer, text, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION checkpoint_youtube_automation_sync(uuid, uuid, uuid, text, timestamptz, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION finish_youtube_automation_connection(uuid, uuid, uuid, boolean, text) TO service_role;

REVOKE ALL ON TABLE youtube_automation_runtime FROM anon, authenticated;
GRANT SELECT ON TABLE youtube_automation_runtime TO authenticated;
GRANT ALL ON TABLE youtube_automation_runtime TO service_role;

COMMENT ON TABLE youtube_automation_runtime IS
  'Durable leases and incremental YouTube sync checkpoints. Contains no OAuth credentials or comment text.';
