-- Phase 3B durable manual publishing primitives.
-- Apply manually after migration 021. This migration does not schedule or publish replies.

CREATE OR REPLACE FUNCTION claim_youtube_manual_publish(
  p_connection_id uuid,
  p_queue_id uuid,
  p_expected_updated_at timestamptz,
  p_run_id uuid,
  p_idempotency_key text
)
RETURNS youtube_comment_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item youtube_comment_queue%ROWTYPE;
  publish_text text;
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
  IF item.processing_state NOT IN ('ready_to_publish', 'publish_failed')
     OR item.approval_status <> 'approved'
     OR item.reply_verification_status <> 'verified_unpublished'
     OR item.publish_result_uncertain
     OR item.published_reply_id IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_manual_publish_transition';
  END IF;

  publish_text := COALESCE(item.edited_reply, item.generated_reply);
  IF publish_text IS NULL OR char_length(trim(publish_text)) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'invalid_publish_draft';
  END IF;
  IF p_idempotency_key IS NULL OR char_length(trim(p_idempotency_key)) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'invalid_idempotency_key';
  END IF;

  UPDATE youtube_comment_queue
  SET
    processing_state = 'publishing',
    publish_attempts = publish_attempts + 1,
    last_attempt_at = now(),
    lock_token = gen_random_uuid(),
    locked_by = 'manual-publish',
    locked_at = now(),
    lease_expires_at = now() + interval '15 minutes',
    next_attempt_at = NULL,
    last_error_stage = NULL,
    last_error_code = NULL,
    last_error_message = NULL
  WHERE id = item.id
  RETURNING * INTO item;

  INSERT INTO youtube_automation_logs (
    connection_id, queue_id, run_id, event_type, severity,
    attempt_number, idempotency_key, message, metadata
  ) VALUES (
    p_connection_id, item.id, p_run_id, 'publish_attempted', 'info',
    item.publish_attempts, trim(p_idempotency_key),
    'Manual YouTube reply publishing claimed.',
    jsonb_build_object('mode', 'manual', 'automation_bypassed', true)
  );

  RETURN item;
END;
$$;

CREATE OR REPLACE FUNCTION finish_youtube_manual_publish(
  p_connection_id uuid,
  p_queue_id uuid,
  p_lock_token uuid,
  p_run_id uuid,
  p_idempotency_key text,
  p_reply_id text,
  p_reply_url text,
  p_published_at timestamptz,
  p_detected_existing boolean
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
    AND processing_state = 'publishing'
    AND lock_token = p_lock_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'manual_publish_lease_lost';
  END IF;
  IF p_reply_id IS NULL OR char_length(trim(p_reply_id)) NOT BETWEEN 1 AND 200
     OR p_published_at IS NULL OR p_detected_existing IS NULL THEN
    RAISE EXCEPTION 'invalid_publish_result';
  END IF;

  UPDATE youtube_comment_queue
  SET
    processing_state = 'published',
    published_reply_id = trim(p_reply_id),
    published_reply_url = NULLIF(trim(COALESCE(p_reply_url, '')), ''),
    published_at = p_published_at,
    publish_result_uncertain = false,
    reply_verification_status = 'verified_published',
    reply_verification_checked_at = now(),
    reply_verification_error = NULL,
    lock_token = NULL,
    locked_by = NULL,
    locked_at = NULL,
    lease_expires_at = NULL,
    next_attempt_at = NULL,
    last_error_stage = NULL,
    last_error_code = NULL,
    last_error_message = NULL
  WHERE id = item.id
  RETURNING * INTO item;

  INSERT INTO youtube_automation_logs (
    connection_id, queue_id, run_id, event_type, severity,
    attempt_number, idempotency_key, message, metadata
  ) VALUES (
    p_connection_id, item.id, p_run_id, 'publish_succeeded', 'info',
    item.publish_attempts, trim(p_idempotency_key) || ':success',
    CASE WHEN p_detected_existing
      THEN 'Existing YouTube channel reply verified and recorded.'
      ELSE 'Manual YouTube reply published successfully.'
    END,
    jsonb_build_object('mode', 'manual', 'detected_existing', p_detected_existing, 'reply_id', item.published_reply_id)
  );

  RETURN item;
END;
$$;

CREATE OR REPLACE FUNCTION fail_youtube_manual_publish(
  p_connection_id uuid,
  p_queue_id uuid,
  p_lock_token uuid,
  p_run_id uuid,
  p_idempotency_key text,
  p_uncertain boolean,
  p_error_code text,
  p_error_message text
)
RETURNS youtube_comment_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item youtube_comment_queue%ROWTYPE;
  safe_code text;
  safe_message text;
BEGIN
  SELECT * INTO item
  FROM youtube_comment_queue
  WHERE id = p_queue_id
    AND connection_id = p_connection_id
    AND processing_state = 'publishing'
    AND lock_token = p_lock_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'manual_publish_lease_lost';
  END IF;
  IF p_uncertain IS NULL THEN
    RAISE EXCEPTION 'invalid_uncertain_flag';
  END IF;

  safe_code := left(COALESCE(NULLIF(trim(p_error_code), ''), 'publish_failed'), 200);
  safe_message := left(COALESCE(NULLIF(trim(p_error_message), ''), 'YouTube reply publishing failed.'), 1000);

  UPDATE youtube_comment_queue
  SET
    processing_state = CASE WHEN p_uncertain THEN 'publish_uncertain' ELSE 'publish_failed' END,
    publish_result_uncertain = p_uncertain,
    lock_token = NULL,
    locked_by = NULL,
    locked_at = NULL,
    lease_expires_at = NULL,
    next_attempt_at = NULL,
    last_error_stage = 'publish',
    last_error_code = safe_code,
    last_error_message = safe_message
  WHERE id = item.id
  RETURNING * INTO item;

  INSERT INTO youtube_automation_logs (
    connection_id, queue_id, run_id, event_type, severity,
    attempt_number, idempotency_key, message, error_code, metadata
  ) VALUES (
    p_connection_id, item.id, p_run_id,
    CASE WHEN p_uncertain THEN 'publish_uncertain' ELSE 'publish_failed' END,
    'error', item.publish_attempts,
    trim(p_idempotency_key) || CASE WHEN p_uncertain THEN ':uncertain' ELSE ':failed' END,
    safe_message, safe_code,
    jsonb_build_object('mode', 'manual', 'automatic_retry_allowed', false)
  );

  RETURN item;
END;
$$;

REVOKE ALL ON FUNCTION claim_youtube_manual_publish(uuid, uuid, timestamptz, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION finish_youtube_manual_publish(uuid, uuid, uuid, uuid, text, text, text, timestamptz, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION fail_youtube_manual_publish(uuid, uuid, uuid, uuid, text, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_youtube_manual_publish(uuid, uuid, timestamptz, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION finish_youtube_manual_publish(uuid, uuid, uuid, uuid, text, text, text, timestamptz, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION fail_youtube_manual_publish(uuid, uuid, uuid, uuid, text, boolean, text, text) TO service_role;

COMMENT ON FUNCTION claim_youtube_manual_publish(uuid, uuid, timestamptz, uuid, text) IS
  'Claims an explicitly approved reply for one manual publish request without consulting automation_enabled.';
