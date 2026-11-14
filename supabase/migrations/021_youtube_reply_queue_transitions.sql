-- Phase 3A transactional Reply Queue transitions.
-- Apply manually after migration 020. This does not schedule or publish replies.

ALTER TABLE youtube_automation_logs
  DROP CONSTRAINT IF EXISTS youtube_automation_logs_event_type;
ALTER TABLE youtube_automation_logs
  ADD CONSTRAINT youtube_automation_logs_event_type
  CHECK (event_type IN (
    'sync_started', 'sync_succeeded', 'sync_failed', 'comment_discovered',
    'draft_started', 'draft_succeeded', 'draft_failed', 'draft_edited',
    'approval_changed', 'publish_attempted', 'publish_succeeded',
    'publish_failed', 'publish_uncertain', 'worker_lease_expired'
  ));

CREATE OR REPLACE FUNCTION transition_youtube_reply_queue_item(
  p_connection_id uuid,
  p_queue_id uuid,
  p_expected_updated_at timestamptz,
  p_action text,
  p_draft text,
  p_run_id uuid
)
RETURNS youtube_comment_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item youtube_comment_queue%ROWTYPE;
  previous_approval text;
  current_draft text;
BEGIN
  SELECT * INTO item
  FROM youtube_comment_queue
  WHERE id = p_queue_id AND connection_id = p_connection_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'queue_item_not_found';
  END IF;
  IF item.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'queue_item_stale';
  END IF;
  IF item.processing_state IN ('published', 'publishing', 'publish_uncertain')
     OR item.published_reply_id IS NOT NULL THEN
    RAISE EXCEPTION 'queue_item_locked';
  END IF;

  previous_approval := item.approval_status;
  current_draft := COALESCE(item.edited_reply, item.generated_reply);

  IF p_action = 'save' THEN
    IF item.processing_state NOT IN ('awaiting_approval', 'ready_to_publish') THEN
      RAISE EXCEPTION 'invalid_save_transition';
    END IF;
    IF p_draft IS NULL OR char_length(trim(p_draft)) NOT BETWEEN 1 AND 1000 THEN
      RAISE EXCEPTION 'invalid_draft';
    END IF;

    UPDATE youtube_comment_queue
    SET
      edited_reply = trim(p_draft),
      approval_status = 'pending',
      processing_state = 'awaiting_approval',
      scheduled_publish_at = NULL,
      next_attempt_at = NULL
    WHERE id = item.id
    RETURNING * INTO item;

    INSERT INTO youtube_automation_logs (
      connection_id, queue_id, run_id, event_type, severity, message, metadata
    ) VALUES (
      p_connection_id, item.id, p_run_id, 'draft_edited', 'info',
      'YouTube reply draft edited and saved.',
      jsonb_build_object('approval_reset', previous_approval <> 'pending')
    );

    IF previous_approval <> 'pending' THEN
      INSERT INTO youtube_automation_logs (
        connection_id, queue_id, run_id, event_type, severity, message, metadata
      ) VALUES (
        p_connection_id, item.id, p_run_id, 'approval_changed', 'info',
        'YouTube reply approval reset after the draft was edited.',
        jsonb_build_object('from', previous_approval, 'to', 'pending', 'reason', 'draft_edited')
      );
    END IF;

  ELSIF p_action = 'approve' THEN
    IF item.processing_state <> 'awaiting_approval'
       OR item.approval_status <> 'pending'
       OR item.reply_verification_status <> 'verified_unpublished' THEN
      RAISE EXCEPTION 'invalid_approve_transition';
    END IF;
    IF current_draft IS NULL OR char_length(trim(current_draft)) NOT BETWEEN 1 AND 1000 THEN
      RAISE EXCEPTION 'invalid_draft';
    END IF;

    UPDATE youtube_comment_queue
    SET
      approval_status = 'approved',
      processing_state = 'ready_to_publish',
      scheduled_publish_at = NULL,
      next_attempt_at = NULL
    WHERE id = item.id
    RETURNING * INTO item;

    INSERT INTO youtube_automation_logs (
      connection_id, queue_id, run_id, event_type, severity, message, metadata
    ) VALUES (
      p_connection_id, item.id, p_run_id, 'approval_changed', 'info',
      'YouTube reply explicitly approved.',
      jsonb_build_object('from', previous_approval, 'to', 'approved')
    );

  ELSIF p_action = 'reject' THEN
    IF item.processing_state NOT IN ('awaiting_approval', 'ready_to_publish', 'draft_failed') THEN
      RAISE EXCEPTION 'invalid_reject_transition';
    END IF;

    UPDATE youtube_comment_queue
    SET
      approval_status = 'rejected',
      processing_state = 'rejected',
      scheduled_publish_at = NULL,
      next_attempt_at = NULL,
      lock_token = NULL,
      locked_by = NULL,
      locked_at = NULL,
      lease_expires_at = NULL
    WHERE id = item.id
    RETURNING * INTO item;

    INSERT INTO youtube_automation_logs (
      connection_id, queue_id, run_id, event_type, severity, message, metadata
    ) VALUES (
      p_connection_id, item.id, p_run_id, 'approval_changed', 'info',
      'YouTube reply explicitly rejected.',
      jsonb_build_object('from', previous_approval, 'to', 'rejected')
    );

  ELSIF p_action = 'begin_regenerate' THEN
    IF item.processing_state NOT IN ('awaiting_approval', 'ready_to_publish', 'draft_failed')
       OR item.reply_verification_status <> 'verified_unpublished' THEN
      RAISE EXCEPTION 'invalid_regenerate_transition';
    END IF;

    UPDATE youtube_comment_queue
    SET
      approval_status = 'pending',
      processing_state = 'generating',
      draft_attempts = draft_attempts + 1,
      last_attempt_at = now(),
      lock_token = gen_random_uuid(),
      locked_by = 'manual-regeneration',
      locked_at = now(),
      lease_expires_at = now() + interval '15 minutes',
      scheduled_publish_at = NULL,
      next_attempt_at = NULL,
      last_error_stage = NULL,
      last_error_code = NULL,
      last_error_message = NULL
    WHERE id = item.id
    RETURNING * INTO item;

    IF previous_approval <> 'pending' THEN
      INSERT INTO youtube_automation_logs (
        connection_id, queue_id, run_id, event_type, severity, message, metadata
      ) VALUES (
        p_connection_id, item.id, p_run_id, 'approval_changed', 'info',
        'YouTube reply approval reset before regeneration.',
        jsonb_build_object('from', previous_approval, 'to', 'pending', 'reason', 'regeneration')
      );
    END IF;

    INSERT INTO youtube_automation_logs (
      connection_id, queue_id, run_id, event_type, severity, attempt_number, message
    ) VALUES (
      p_connection_id, item.id, p_run_id, 'draft_started', 'info',
      item.draft_attempts, 'YouTube reply regeneration started.'
    );
  ELSE
    RAISE EXCEPTION 'unsupported_queue_action';
  END IF;

  RETURN item;
END;
$$;

CREATE OR REPLACE FUNCTION finish_youtube_reply_regeneration(
  p_connection_id uuid,
  p_queue_id uuid,
  p_lock_token uuid,
  p_run_id uuid,
  p_draft text,
  p_category text,
  p_confidence numeric,
  p_skip boolean
)
RETURNS youtube_comment_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item youtube_comment_queue%ROWTYPE;
BEGIN
  SELECT * INTO item
  FROM youtube_comment_queue
  WHERE id = p_queue_id
    AND connection_id = p_connection_id
    AND processing_state = 'generating'
    AND lock_token = p_lock_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'regeneration_lease_lost';
  END IF;
  IF p_skip IS NULL THEN
    RAISE EXCEPTION 'invalid_skip_flag';
  END IF;
  IF NOT p_skip AND (p_draft IS NULL OR char_length(trim(p_draft)) NOT BETWEEN 1 AND 1000) THEN
    RAISE EXCEPTION 'invalid_draft';
  END IF;
  IF p_confidence IS NOT NULL AND (p_confidence < 0 OR p_confidence > 1) THEN
    RAISE EXCEPTION 'invalid_confidence';
  END IF;

  UPDATE youtube_comment_queue
  SET
    category = COALESCE(p_category, category),
    category_confidence = COALESCE(p_confidence, category_confidence),
    generated_reply = CASE WHEN p_skip THEN NULL ELSE trim(p_draft) END,
    edited_reply = NULL,
    processing_state = CASE WHEN p_skip THEN 'skipped' ELSE 'awaiting_approval' END,
    approval_status = 'pending',
    lock_token = NULL,
    locked_by = NULL,
    locked_at = NULL,
    lease_expires_at = NULL,
    last_error_stage = NULL,
    last_error_code = NULL,
    last_error_message = NULL
  WHERE id = item.id
  RETURNING * INTO item;

  INSERT INTO youtube_automation_logs (
    connection_id, queue_id, run_id, event_type, severity, attempt_number, message, metadata
  ) VALUES (
    p_connection_id, item.id, p_run_id, 'draft_succeeded', 'info', item.draft_attempts,
    CASE WHEN p_skip
      THEN 'YouTube comment classified as spam and skipped during regeneration.'
      ELSE 'Regenerated YouTube AI draft saved for manual approval.'
    END,
    jsonb_build_object('category', item.category, 'confidence', item.category_confidence, 'drafted', NOT p_skip)
  );

  RETURN item;
END;
$$;

CREATE OR REPLACE FUNCTION fail_youtube_reply_regeneration(
  p_connection_id uuid,
  p_queue_id uuid,
  p_lock_token uuid,
  p_run_id uuid,
  p_error_code text
)
RETURNS youtube_comment_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item youtube_comment_queue%ROWTYPE;
  has_existing_draft boolean;
BEGIN
  SELECT * INTO item
  FROM youtube_comment_queue
  WHERE id = p_queue_id
    AND connection_id = p_connection_id
    AND processing_state = 'generating'
    AND lock_token = p_lock_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'regeneration_lease_lost';
  END IF;

  has_existing_draft := COALESCE(item.edited_reply, item.generated_reply) IS NOT NULL;

  UPDATE youtube_comment_queue
  SET
    processing_state = CASE WHEN has_existing_draft THEN 'awaiting_approval' ELSE 'draft_failed' END,
    approval_status = 'pending',
    lock_token = NULL,
    locked_by = NULL,
    locked_at = NULL,
    lease_expires_at = NULL,
    last_error_stage = 'draft',
    last_error_code = left(COALESCE(p_error_code, 'regeneration_failed'), 200),
    last_error_message = 'YouTube reply regeneration failed. The previous draft, if any, was preserved.'
  WHERE id = item.id
  RETURNING * INTO item;

  INSERT INTO youtube_automation_logs (
    connection_id, queue_id, run_id, event_type, severity, attempt_number, message, error_code
  ) VALUES (
    p_connection_id, item.id, p_run_id, 'draft_failed', 'error', item.draft_attempts,
    'YouTube reply regeneration failed.', left(COALESCE(p_error_code, 'regeneration_failed'), 200)
  );

  RETURN item;
END;
$$;

REVOKE ALL ON FUNCTION transition_youtube_reply_queue_item(uuid, uuid, timestamptz, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION finish_youtube_reply_regeneration(uuid, uuid, uuid, uuid, text, text, numeric, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION fail_youtube_reply_regeneration(uuid, uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transition_youtube_reply_queue_item(uuid, uuid, timestamptz, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION finish_youtube_reply_regeneration(uuid, uuid, uuid, uuid, text, text, numeric, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION fail_youtube_reply_regeneration(uuid, uuid, uuid, uuid, text) TO service_role;
