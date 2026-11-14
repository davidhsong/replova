-- Phase 1 only: database foundation for YouTube automation.
-- This migration is additive and must be applied manually.
-- It does not schedule workers, call external APIs, or enable auto-publishing.

CREATE TABLE IF NOT EXISTS youtube_automation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL UNIQUE REFERENCES youtube_connections(id) ON DELETE CASCADE,
  automation_enabled boolean NOT NULL DEFAULT false,
  auto_publish_enabled boolean NOT NULL DEFAULT false,
  auto_publish_authorized_at timestamptz,
  auto_publish_authorized_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  auto_publish_consent_version text,
  auto_publish_revoked_at timestamptz,
  category_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  max_comments_per_sync integer NOT NULL DEFAULT 50,
  max_drafts_per_run integer NOT NULL DEFAULT 20,
  max_draft_attempts integer NOT NULL DEFAULT 3,
  max_publish_attempts integer NOT NULL DEFAULT 3,
  max_auto_publishes_per_day integer NOT NULL DEFAULT 5,
  min_auto_publish_confidence numeric(4,3) NOT NULL DEFAULT 0.900,
  reply_delay_minutes integer NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT youtube_automation_settings_category_rules_object
    CHECK (jsonb_typeof(category_rules) = 'object'),
  CONSTRAINT youtube_automation_settings_consent_fields
    CHECK (
      (
        auto_publish_authorized_at IS NULL
        AND auto_publish_authorized_by IS NULL
        AND auto_publish_consent_version IS NULL
      )
      OR (
        auto_publish_authorized_at IS NOT NULL
        AND auto_publish_authorized_by IS NOT NULL
        AND auto_publish_consent_version IS NOT NULL
        AND char_length(trim(auto_publish_consent_version)) BETWEEN 1 AND 100
      )
    ),
  CONSTRAINT youtube_automation_settings_auto_publish_consent
    CHECK (
      auto_publish_enabled = false
      OR (
        auto_publish_authorized_at IS NOT NULL
        AND auto_publish_authorized_by IS NOT NULL
        AND auto_publish_consent_version IS NOT NULL
        AND auto_publish_revoked_at IS NULL
      )
    ),
  CONSTRAINT youtube_automation_settings_revocation
    CHECK (auto_publish_revoked_at IS NULL OR auto_publish_enabled = false),
  CONSTRAINT youtube_automation_settings_comments_limit
    CHECK (max_comments_per_sync BETWEEN 1 AND 100),
  CONSTRAINT youtube_automation_settings_drafts_limit
    CHECK (max_drafts_per_run BETWEEN 1 AND 100),
  CONSTRAINT youtube_automation_settings_draft_attempts
    CHECK (max_draft_attempts BETWEEN 1 AND 10),
  CONSTRAINT youtube_automation_settings_publish_attempts
    CHECK (max_publish_attempts BETWEEN 1 AND 10),
  CONSTRAINT youtube_automation_settings_daily_publish_limit
    CHECK (max_auto_publishes_per_day BETWEEN 1 AND 500),
  CONSTRAINT youtube_automation_settings_confidence
    CHECK (min_auto_publish_confidence BETWEEN 0 AND 1),
  CONSTRAINT youtube_automation_settings_delay
    CHECK (reply_delay_minutes BETWEEN 0 AND 10080)
);

COMMENT ON COLUMN youtube_automation_settings.auto_publish_enabled IS
  'Opt-in kill switch. Defaults false; category rules alone never enable auto-publishing.';
COMMENT ON COLUMN youtube_automation_settings.auto_publish_authorized_at IS
  'Server-recorded timestamp of the owner consent action required before auto-publishing can be enabled.';
COMMENT ON COLUMN youtube_automation_settings.category_rules IS
  'Category-specific actions and limits. An absent rule means manual approval.';

CREATE TABLE IF NOT EXISTS youtube_comment_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES youtube_connections(id) ON DELETE CASCADE,
  youtube_comment_id text NOT NULL,
  youtube_thread_id text NOT NULL,
  video_id text NOT NULL,
  author_channel_id text,
  author_display_name text,
  comment_text text NOT NULL,
  comment_published_at timestamptz NOT NULL,
  comment_updated_at timestamptz,
  reply_count integer NOT NULL DEFAULT 0,
  category text,
  category_confidence numeric(4,3),
  processing_state text NOT NULL DEFAULT 'discovered',
  approval_status text NOT NULL DEFAULT 'pending',
  generated_reply text,
  edited_reply text,
  scheduled_publish_at timestamptz,
  published_reply_id text,
  published_reply_url text,
  published_at timestamptz,
  draft_attempts integer NOT NULL DEFAULT 0,
  publish_attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  last_attempt_at timestamptz,
  lock_token uuid,
  locked_by text,
  locked_at timestamptz,
  lease_expires_at timestamptz,
  publish_result_uncertain boolean NOT NULL DEFAULT false,
  last_error_stage text,
  last_error_code text,
  last_error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT youtube_comment_queue_comment_unique
    UNIQUE (connection_id, youtube_comment_id),
  CONSTRAINT youtube_comment_queue_external_ids
    CHECK (
      char_length(youtube_comment_id) BETWEEN 1 AND 200
      AND char_length(youtube_thread_id) BETWEEN 1 AND 200
      AND char_length(video_id) BETWEEN 1 AND 200
    ),
  CONSTRAINT youtube_comment_queue_comment_text
    CHECK (char_length(comment_text) BETWEEN 1 AND 10000),
  CONSTRAINT youtube_comment_queue_reply_count
    CHECK (reply_count >= 0),
  CONSTRAINT youtube_comment_queue_confidence
    CHECK (category_confidence IS NULL OR category_confidence BETWEEN 0 AND 1),
  CONSTRAINT youtube_comment_queue_processing_state
    CHECK (processing_state IN (
      'discovered', 'queued_for_draft', 'generating', 'awaiting_approval',
      'ready_to_publish', 'publishing', 'published', 'rejected', 'skipped',
      'draft_failed', 'publish_failed', 'publish_uncertain'
    )),
  CONSTRAINT youtube_comment_queue_approval_status
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'not_required')),
  CONSTRAINT youtube_comment_queue_attempt_counts
    CHECK (draft_attempts >= 0 AND publish_attempts >= 0),
  CONSTRAINT youtube_comment_queue_reply_lengths
    CHECK (
      (generated_reply IS NULL OR char_length(generated_reply) BETWEEN 1 AND 1000)
      AND (edited_reply IS NULL OR char_length(edited_reply) BETWEEN 1 AND 1000)
    ),
  CONSTRAINT youtube_comment_queue_publish_approval
    CHECK (
      processing_state NOT IN ('ready_to_publish', 'publishing')
      OR approval_status IN ('approved', 'not_required')
    ),
  CONSTRAINT youtube_comment_queue_rejected_state
    CHECK (processing_state <> 'rejected' OR approval_status = 'rejected'),
  CONSTRAINT youtube_comment_queue_published_fields
    CHECK (
      (
        processing_state = 'published'
        AND published_reply_id IS NOT NULL
        AND published_at IS NOT NULL
      )
      OR (
        processing_state <> 'published'
        AND published_reply_id IS NULL
        AND published_at IS NULL
      )
    ),
  CONSTRAINT youtube_comment_queue_uncertain_state
    CHECK (
      publish_result_uncertain = false
      OR processing_state = 'publish_uncertain'
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS youtube_comment_queue_published_reply_unique
  ON youtube_comment_queue (connection_id, published_reply_id)
  WHERE published_reply_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS youtube_comment_queue_draft_claim
  ON youtube_comment_queue (processing_state, next_attempt_at, created_at)
  WHERE processing_state IN ('queued_for_draft', 'draft_failed', 'generating');

CREATE INDEX IF NOT EXISTS youtube_comment_queue_publish_claim
  ON youtube_comment_queue (processing_state, scheduled_publish_at, next_attempt_at)
  WHERE processing_state IN ('ready_to_publish', 'publish_failed');

CREATE INDEX IF NOT EXISTS youtube_comment_queue_connection_date
  ON youtube_comment_queue (connection_id, comment_published_at DESC);

-- Atomic daily reservations make the auto-publish ceiling safe across
-- concurrent workers and multi-item claims. Reservations are conservative:
-- a failed or uncertain attempt still consumes its slot for that UTC day.
CREATE TABLE IF NOT EXISTS youtube_auto_publish_daily_usage (
  connection_id uuid NOT NULL REFERENCES youtube_connections(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT current_date,
  reserved_count integer NOT NULL DEFAULT 0,
  published_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (connection_id, usage_date),
  CONSTRAINT youtube_auto_publish_daily_usage_counts
    CHECK (
      reserved_count >= 0
      AND published_count >= 0
      AND published_count <= reserved_count
    )
);

CREATE TABLE IF NOT EXISTS youtube_automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES youtube_connections(id) ON DELETE CASCADE,
  queue_id uuid REFERENCES youtube_comment_queue(id) ON DELETE SET NULL,
  run_id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  attempt_number integer,
  idempotency_key text,
  message text,
  error_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT youtube_automation_logs_event_type
    CHECK (event_type IN (
      'sync_started', 'sync_succeeded', 'sync_failed', 'comment_discovered',
      'draft_started', 'draft_succeeded', 'draft_failed', 'approval_changed',
      'publish_attempted', 'publish_succeeded', 'publish_failed',
      'publish_uncertain', 'worker_lease_expired'
    )),
  CONSTRAINT youtube_automation_logs_severity
    CHECK (severity IN ('debug', 'info', 'warning', 'error')),
  CONSTRAINT youtube_automation_logs_attempt
    CHECK (attempt_number IS NULL OR attempt_number >= 0),
  CONSTRAINT youtube_automation_logs_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS youtube_automation_logs_idempotency_unique
  ON youtube_automation_logs (connection_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS youtube_automation_logs_connection_date
  ON youtube_automation_logs (connection_id, created_at DESC);

CREATE INDEX IF NOT EXISTS youtube_automation_logs_run
  ON youtube_automation_logs (run_id, created_at ASC);

CREATE INDEX IF NOT EXISTS youtube_automation_logs_queue
  ON youtube_automation_logs (queue_id, created_at ASC)
  WHERE queue_id IS NOT NULL;

-- Keep mutable rows' timestamps reliable regardless of which worker updates them.
CREATE OR REPLACE FUNCTION set_youtube_automation_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS youtube_automation_settings_updated_at ON youtube_automation_settings;
CREATE TRIGGER youtube_automation_settings_updated_at
BEFORE UPDATE ON youtube_automation_settings
FOR EACH ROW EXECUTE FUNCTION set_youtube_automation_updated_at();

DROP TRIGGER IF EXISTS youtube_comment_queue_updated_at ON youtube_comment_queue;
CREATE TRIGGER youtube_comment_queue_updated_at
BEFORE UPDATE ON youtube_comment_queue
FOR EACH ROW EXECUTE FUNCTION set_youtube_automation_updated_at();

DROP TRIGGER IF EXISTS youtube_auto_publish_daily_usage_updated_at ON youtube_auto_publish_daily_usage;
CREATE TRIGGER youtube_auto_publish_daily_usage_updated_at
BEFORE UPDATE ON youtube_auto_publish_daily_usage
FOR EACH ROW EXECUTE FUNCTION set_youtube_automation_updated_at();

-- Ownership helper works for restaurant-free developer accounts because the
-- connection is tied directly to auth.users rather than restaurants.
CREATE OR REPLACE FUNCTION owns_youtube_connection(cid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM youtube_connections
    WHERE id = cid AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION owns_youtube_connection(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION owns_youtube_connection(uuid) TO authenticated;

-- Consent fields are server-written and must identify the auth user who owns
-- the connection. RLS below intentionally exposes no direct client writes.
CREATE OR REPLACE FUNCTION validate_youtube_auto_publish_consent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  connection_owner uuid;
BEGIN
  SELECT user_id INTO connection_owner
  FROM youtube_connections
  WHERE id = NEW.connection_id;

  IF connection_owner IS NULL THEN
    RAISE EXCEPTION 'YouTube connection not found';
  END IF;

  IF NEW.auto_publish_authorized_by IS NOT NULL
     AND NEW.auto_publish_authorized_by <> connection_owner THEN
    RAISE EXCEPTION 'Auto-publish consent must be granted by the connection owner';
  END IF;

  IF NEW.auto_publish_enabled AND (
    NEW.auto_publish_authorized_at IS NULL
    OR NEW.auto_publish_authorized_by IS NULL
    OR NEW.auto_publish_consent_version IS NULL
    OR NEW.auto_publish_revoked_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Valid owner consent is required before enabling auto-publish';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS youtube_automation_settings_validate_consent ON youtube_automation_settings;
CREATE TRIGGER youtube_automation_settings_validate_consent
BEFORE INSERT OR UPDATE ON youtube_automation_settings
FOR EACH ROW EXECUTE FUNCTION validate_youtube_auto_publish_consent();

REVOKE ALL ON FUNCTION validate_youtube_auto_publish_consent() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION validate_youtube_auto_publish_consent() TO service_role;
REVOKE ALL ON FUNCTION set_youtube_automation_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_youtube_automation_updated_at() TO service_role;

ALTER TABLE youtube_automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_comment_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_auto_publish_daily_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "youtube settings owner select"
  ON youtube_automation_settings FOR SELECT
  TO authenticated USING (owns_youtube_connection(connection_id));

-- Queue and logs are readable by their owner but writable only through
-- authenticated server routes/workers using the service role.
CREATE POLICY "youtube queue owner select"
  ON youtube_comment_queue FOR SELECT
  TO authenticated USING (owns_youtube_connection(connection_id));
CREATE POLICY "youtube logs owner select"
  ON youtube_automation_logs FOR SELECT
  TO authenticated USING (owns_youtube_connection(connection_id));
CREATE POLICY "youtube daily usage owner select"
  ON youtube_auto_publish_daily_usage FOR SELECT
  TO authenticated USING (owns_youtube_connection(connection_id));

-- Atomic draft claims may recover expired generation leases because draft
-- generation is idempotent. Publish claims intentionally never reclaim a row
-- left in `publishing`; it must first be reconciled with YouTube.
CREATE OR REPLACE FUNCTION claim_youtube_draft_items(
  batch_size integer DEFAULT 20,
  worker_id text DEFAULT 'worker',
  lease_minutes integer DEFAULT 15
)
RETURNS SETOF youtube_comment_queue
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH candidates AS (
    SELECT queue.id
    FROM youtube_comment_queue AS queue
    LEFT JOIN youtube_automation_settings AS settings
      ON settings.connection_id = queue.connection_id
    WHERE (
        queue.processing_state IN ('queued_for_draft', 'draft_failed')
        OR (
          queue.processing_state = 'generating'
          AND queue.lease_expires_at IS NOT NULL
          AND queue.lease_expires_at < now()
        )
      )
      AND settings.automation_enabled = true
      AND queue.draft_attempts < COALESCE(settings.max_draft_attempts, 3)
      AND (queue.next_attempt_at IS NULL OR queue.next_attempt_at <= now())
    ORDER BY queue.created_at ASC
    FOR UPDATE OF queue SKIP LOCKED
    LIMIT greatest(1, least(batch_size, 100))
  ), claimed AS (
    UPDATE youtube_comment_queue AS queue
    SET
      processing_state = 'generating',
      draft_attempts = queue.draft_attempts + 1,
      last_attempt_at = now(),
      lock_token = gen_random_uuid(),
      locked_by = left(worker_id, 200),
      locked_at = now(),
      lease_expires_at = now() + make_interval(mins => greatest(1, least(lease_minutes, 60)))
    FROM candidates
    WHERE queue.id = candidates.id
    RETURNING queue.*
  )
  SELECT * FROM claimed;
$$;

CREATE OR REPLACE FUNCTION claim_youtube_publish_items(
  batch_size integer DEFAULT 10,
  worker_id text DEFAULT 'worker',
  lease_minutes integer DEFAULT 15
)
RETURNS SETOF youtube_comment_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate record;
  claimed youtube_comment_queue%ROWTYPE;
  reserved_connection uuid;
BEGIN
  FOR candidate IN
    SELECT
      queue.id,
      queue.connection_id,
      queue.approval_status,
      settings.max_auto_publishes_per_day
    FROM youtube_comment_queue AS queue
    JOIN youtube_automation_settings AS settings
      ON settings.connection_id = queue.connection_id
    JOIN youtube_connections AS connection
      ON connection.id = queue.connection_id
    WHERE queue.processing_state IN ('ready_to_publish', 'publish_failed')
      AND settings.automation_enabled = true
      AND (
        queue.approval_status = 'approved'
        OR (
          queue.approval_status = 'not_required'
          AND settings.auto_publish_enabled = true
          AND settings.auto_publish_authorized_at IS NOT NULL
          AND settings.auto_publish_authorized_by = connection.user_id
          AND settings.auto_publish_consent_version IS NOT NULL
          AND settings.auto_publish_revoked_at IS NULL
        )
      )
      AND queue.publish_result_uncertain = false
      AND queue.publish_attempts < settings.max_publish_attempts
      AND (queue.scheduled_publish_at IS NULL OR queue.scheduled_publish_at <= now())
      AND (queue.next_attempt_at IS NULL OR queue.next_attempt_at <= now())
    ORDER BY COALESCE(queue.scheduled_publish_at, queue.created_at) ASC
    FOR UPDATE OF queue SKIP LOCKED
    LIMIT greatest(1, least(batch_size, 100))
  LOOP
    reserved_connection := NULL;

    IF candidate.approval_status = 'not_required' THEN
      INSERT INTO youtube_auto_publish_daily_usage (
        connection_id, usage_date, reserved_count, published_count
      ) VALUES (
        candidate.connection_id, current_date, 1, 0
      )
      ON CONFLICT (connection_id, usage_date) DO UPDATE
      SET
        reserved_count = youtube_auto_publish_daily_usage.reserved_count + 1,
        updated_at = now()
      WHERE youtube_auto_publish_daily_usage.reserved_count < candidate.max_auto_publishes_per_day
      RETURNING connection_id INTO reserved_connection;

      IF reserved_connection IS NULL THEN
        CONTINUE;
      END IF;
    END IF;

    UPDATE youtube_comment_queue AS queue
    SET
      processing_state = 'publishing',
      publish_attempts = queue.publish_attempts + 1,
      last_attempt_at = now(),
      lock_token = gen_random_uuid(),
      locked_by = left(worker_id, 200),
      locked_at = now(),
      lease_expires_at = now() + make_interval(mins => greatest(1, least(lease_minutes, 60)))
    WHERE queue.id = candidate.id
    RETURNING queue.* INTO claimed;

    RETURN NEXT claimed;
  END LOOP;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION claim_youtube_draft_items(integer, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_youtube_publish_items(integer, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_youtube_draft_items(integer, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION claim_youtube_publish_items(integer, text, integer) TO service_role;

COMMENT ON TABLE youtube_comment_queue IS
  'Persistent YouTube comment, AI draft, approval, and publish queue. One row per connection/comment.';
COMMENT ON TABLE youtube_automation_logs IS
  'Append-only operational events for YouTube sync, drafting, approval, and publishing.';
