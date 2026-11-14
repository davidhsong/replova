-- Phase 2B claim hardening. Apply manually after migrations 018 and 019.
-- This migration does not schedule workers, generate drafts, or publish replies.

DROP FUNCTION IF EXISTS claim_youtube_draft_items(integer, text, integer);
DROP FUNCTION IF EXISTS claim_youtube_draft_items(integer, text, integer, uuid, boolean);

CREATE FUNCTION claim_youtube_draft_items(
  batch_size integer DEFAULT 20,
  worker_id text DEFAULT 'worker',
  lease_minutes integer DEFAULT 15,
  connection_filter uuid DEFAULT NULL,
  require_automation_enabled boolean DEFAULT true
)
RETURNS SETOF youtube_comment_queue
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH eligible AS MATERIALIZED (
    SELECT
      queue.id,
      queue.connection_id,
      queue.created_at,
      row_number() OVER (
        PARTITION BY queue.connection_id
        ORDER BY queue.created_at ASC
      ) AS connection_position,
      least(
        settings.max_drafts_per_run,
        greatest(1, least(batch_size, 100))
      ) AS connection_limit
    FROM youtube_comment_queue AS queue
    JOIN youtube_automation_settings AS settings
      ON settings.connection_id = queue.connection_id
    JOIN youtube_connections AS connection
      ON connection.id = queue.connection_id
    WHERE (
        queue.processing_state IN ('discovered', 'queued_for_draft', 'draft_failed')
        OR (
          queue.processing_state = 'generating'
          AND queue.lease_expires_at IS NOT NULL
          AND queue.lease_expires_at < now()
        )
      )
      AND queue.reply_verification_status = 'verified_unpublished'
      AND queue.author_channel_id IS NOT NULL
      AND queue.author_channel_id <> connection.channel_id
      AND queue.draft_attempts < settings.max_draft_attempts
      AND (queue.next_attempt_at IS NULL OR queue.next_attempt_at <= now())
      AND (connection_filter IS NULL OR queue.connection_id = connection_filter)
      AND (require_automation_enabled = false OR settings.automation_enabled = true)
  ), candidates AS (
    SELECT queue.id
    FROM youtube_comment_queue AS queue
    JOIN eligible ON eligible.id = queue.id
    WHERE eligible.connection_position <= eligible.connection_limit
    ORDER BY eligible.created_at ASC
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
      lease_expires_at = now() + make_interval(mins => greatest(1, least(lease_minutes, 60))),
      last_error_stage = NULL,
      last_error_code = NULL,
      last_error_message = NULL
    FROM candidates
    WHERE queue.id = candidates.id
    RETURNING queue.*
  )
  SELECT * FROM claimed;
$$;

DROP FUNCTION IF EXISTS claim_youtube_publish_items(integer, text, integer);

CREATE FUNCTION claim_youtube_publish_items(
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
      AND queue.reply_verification_status = 'verified_unpublished'
      AND queue.author_channel_id IS NOT NULL
      AND queue.author_channel_id <> connection.channel_id
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

REVOKE ALL ON FUNCTION claim_youtube_draft_items(integer, text, integer, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_youtube_publish_items(integer, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_youtube_draft_items(integer, text, integer, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION claim_youtube_publish_items(integer, text, integer) TO service_role;

COMMENT ON FUNCTION claim_youtube_draft_items(integer, text, integer, uuid, boolean) IS
  'Atomically claims only verified-unpublished, non-self comments. Manual owner-scoped runs may bypass the automation-enabled switch.';
