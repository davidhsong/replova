-- Phase 5A reusable knowledge bases and context-aware YouTube drafting.
-- Apply manually after migration 023. This migration does not regenerate drafts,
-- schedule work, change publishing consent, or publish replies.

CREATE TABLE IF NOT EXISTS knowledge_bases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_connection_id uuid NOT NULL,
  display_name text,
  description text NOT NULL DEFAULT '',
  response_guidelines text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_bases_provider_format
    CHECK (provider ~ '^[a-z][a-z0-9_]{1,49}$'),
  CONSTRAINT knowledge_bases_display_name_length
    CHECK (display_name IS NULL OR char_length(display_name) <= 200),
  CONSTRAINT knowledge_bases_description_length
    CHECK (char_length(description) <= 4000),
  CONSTRAINT knowledge_bases_guidelines_length
    CHECK (char_length(response_guidelines) <= 3000),
  CONSTRAINT knowledge_bases_provider_connection_unique
    UNIQUE (provider, provider_connection_id)
);

CREATE TABLE IF NOT EXISTS knowledge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id uuid NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type text NOT NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  scope_type text NOT NULL DEFAULT 'general',
  scope_key text,
  source_title text,
  source_description text,
  source_fetched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_entries_type
    CHECK (entry_type IN ('faq', 'fact', 'video_context')),
  CONSTRAINT knowledge_entries_scope
    CHECK (scope_type IN ('general', 'youtube_video')),
  CONSTRAINT knowledge_entries_scope_key
    CHECK (
      (scope_type = 'general' AND scope_key IS NULL)
      OR (
        scope_type = 'youtube_video'
        AND scope_key IS NOT NULL
        AND char_length(trim(scope_key)) BETWEEN 1 AND 200
      )
    ),
  CONSTRAINT knowledge_entries_video_shape
    CHECK (
      (entry_type = 'video_context' AND scope_type = 'youtube_video')
      OR entry_type <> 'video_context'
    ),
  CONSTRAINT knowledge_entries_title_length
    CHECK (char_length(trim(title)) BETWEEN 1 AND 500),
  CONSTRAINT knowledge_entries_content_length
    CHECK (
      char_length(content) <= 4000
      AND (entry_type = 'video_context' OR char_length(trim(content)) >= 1)
    ),
  CONSTRAINT knowledge_entries_source_title_length
    CHECK (source_title IS NULL OR char_length(source_title) <= 300),
  CONSTRAINT knowledge_entries_source_description_length
    CHECK (source_description IS NULL OR char_length(source_description) <= 5000)
);

CREATE INDEX IF NOT EXISTS knowledge_bases_owner
  ON knowledge_bases (owner_user_id, provider);
CREATE INDEX IF NOT EXISTS knowledge_entries_base_scope
  ON knowledge_entries (knowledge_base_id, scope_type, scope_key, entry_type);
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_entries_general_subject_unique
  ON knowledge_entries (knowledge_base_id, entry_type, lower(trim(title)))
  WHERE scope_type = 'general' AND entry_type IN ('faq', 'fact');
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_entries_video_subject_unique
  ON knowledge_entries (knowledge_base_id, entry_type, scope_key, lower(trim(title)))
  WHERE scope_type = 'youtube_video' AND entry_type IN ('faq', 'fact');
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_entries_video_context_unique
  ON knowledge_entries (knowledge_base_id, scope_key)
  WHERE entry_type = 'video_context';
CREATE OR REPLACE FUNCTION set_replova_knowledge_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS knowledge_bases_updated_at ON knowledge_bases;
CREATE TRIGGER knowledge_bases_updated_at
BEFORE UPDATE ON knowledge_bases
FOR EACH ROW EXECUTE FUNCTION set_replova_knowledge_updated_at();

DROP TRIGGER IF EXISTS knowledge_entries_updated_at ON knowledge_entries;
CREATE TRIGGER knowledge_entries_updated_at
BEFORE UPDATE ON knowledge_entries
FOR EACH ROW EXECUTE FUNCTION set_replova_knowledge_updated_at();

CREATE OR REPLACE FUNCTION validate_replova_knowledge_base_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.provider = 'youtube' AND NOT EXISTS (
    SELECT 1 FROM youtube_connections
    WHERE id = NEW.provider_connection_id
      AND user_id = NEW.owner_user_id
  ) THEN
    RAISE EXCEPTION 'knowledge_base_owner_mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS knowledge_bases_validate_owner ON knowledge_bases;
CREATE TRIGGER knowledge_bases_validate_owner
BEFORE INSERT OR UPDATE OF owner_user_id, provider, provider_connection_id ON knowledge_bases
FOR EACH ROW EXECUTE FUNCTION validate_replova_knowledge_base_owner();

-- Provider-neutral knowledge bases cannot use a direct foreign key to every
-- provider's connection table. This trigger gives YouTube connections the same
-- cascade semantics and prevents stale knowledge from surviving reconnects.
CREATE OR REPLACE FUNCTION delete_youtube_knowledge_base_on_disconnect()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM knowledge_bases
  WHERE provider = 'youtube'
    AND provider_connection_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS youtube_connections_delete_knowledge_base ON youtube_connections;
CREATE TRIGGER youtube_connections_delete_knowledge_base
AFTER DELETE ON youtube_connections
FOR EACH ROW EXECUTE FUNCTION delete_youtube_knowledge_base_on_disconnect();

CREATE OR REPLACE FUNCTION validate_replova_knowledge_entry_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_owner uuid;
BEGIN
  SELECT owner_user_id INTO base_owner
  FROM knowledge_bases
  WHERE id = NEW.knowledge_base_id;

  IF base_owner IS NULL OR NEW.owner_user_id <> base_owner THEN
    RAISE EXCEPTION 'knowledge_entry_owner_mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS knowledge_entries_validate_owner ON knowledge_entries;
CREATE TRIGGER knowledge_entries_validate_owner
BEFORE INSERT OR UPDATE OF knowledge_base_id, owner_user_id ON knowledge_entries
FOR EACH ROW EXECUTE FUNCTION validate_replova_knowledge_entry_owner();

ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "knowledge base owner select" ON knowledge_bases;
CREATE POLICY "knowledge base owner select"
  ON knowledge_bases FOR SELECT
  TO authenticated USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "knowledge entry owner select" ON knowledge_entries;
CREATE POLICY "knowledge entry owner select"
  ON knowledge_entries FOR SELECT
  TO authenticated USING (owner_user_id = auth.uid());

REVOKE ALL ON TABLE knowledge_bases FROM anon, authenticated;
REVOKE ALL ON TABLE knowledge_entries FROM anon, authenticated;
GRANT SELECT ON TABLE knowledge_bases TO authenticated;
GRANT SELECT ON TABLE knowledge_entries TO authenticated;
GRANT ALL ON TABLE knowledge_bases TO service_role;
GRANT ALL ON TABLE knowledge_entries TO service_role;
REVOKE ALL ON FUNCTION set_replova_knowledge_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION validate_replova_knowledge_base_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION validate_replova_knowledge_entry_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_youtube_knowledge_base_on_disconnect() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_replova_knowledge_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION validate_replova_knowledge_base_owner() TO service_role;
GRANT EXECUTE ON FUNCTION validate_replova_knowledge_entry_owner() TO service_role;
GRANT EXECUTE ON FUNCTION delete_youtube_knowledge_base_on_disconnect() TO service_role;

ALTER TABLE youtube_comment_queue
  ADD COLUMN IF NOT EXISTS requires_manual_review boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS manual_review_reason text,
  ADD COLUMN IF NOT EXISTS knowledge_entry_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS knowledge_context_used_at timestamptz;

-- Existing non-terminal drafts inherit the conservative true default. Terminal
-- records remain terminal and are not presented as newly requiring review.
UPDATE youtube_comment_queue
SET requires_manual_review = false
WHERE processing_state IN ('published', 'skipped', 'rejected');

ALTER TABLE youtube_comment_queue
  DROP CONSTRAINT IF EXISTS youtube_comment_queue_manual_review_reason_length;
ALTER TABLE youtube_comment_queue
  ADD CONSTRAINT youtube_comment_queue_manual_review_reason_length
  CHECK (manual_review_reason IS NULL OR char_length(manual_review_reason) <= 500);

-- Regeneration completion remains transactional while persisting the context
-- review flag and the exact knowledge-entry identifiers used for the draft.
CREATE OR REPLACE FUNCTION finish_youtube_reply_regeneration_with_context(
  p_connection_id uuid,
  p_queue_id uuid,
  p_lock_token uuid,
  p_run_id uuid,
  p_draft text,
  p_category text,
  p_confidence numeric,
  p_skip boolean,
  p_requires_manual_review boolean,
  p_manual_review_reason text,
  p_knowledge_entry_ids uuid[]
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

  IF NOT FOUND THEN RAISE EXCEPTION 'regeneration_lease_lost'; END IF;
  IF p_skip IS NULL OR p_requires_manual_review IS NULL THEN
    RAISE EXCEPTION 'invalid_context_flags';
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
    requires_manual_review = CASE WHEN p_skip THEN false ELSE p_requires_manual_review END,
    manual_review_reason = CASE WHEN p_skip THEN NULL ELSE left(NULLIF(trim(COALESCE(p_manual_review_reason, '')), ''), 500) END,
    knowledge_entry_ids = CASE WHEN p_skip THEN '{}'::uuid[] ELSE COALESCE(p_knowledge_entry_ids, '{}'::uuid[]) END,
    knowledge_context_used_at = CASE WHEN p_skip THEN NULL ELSE now() END,
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
      ELSE 'Context-aware YouTube AI draft saved for manual approval.'
    END,
    jsonb_build_object(
      'category', item.category,
      'confidence', item.category_confidence,
      'drafted', NOT p_skip,
      'requires_manual_review', item.requires_manual_review,
      'knowledge_entry_count', cardinality(item.knowledge_entry_ids)
    )
  );

  RETURN item;
END;
$$;

REVOKE ALL ON FUNCTION finish_youtube_reply_regeneration_with_context(
  uuid, uuid, uuid, uuid, text, text, numeric, boolean, boolean, text, uuid[]
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finish_youtube_reply_regeneration_with_context(
  uuid, uuid, uuid, uuid, text, text, numeric, boolean, boolean, text, uuid[]
) TO service_role;

-- Expand/contract compatibility: production instances running the Phase 3A
-- route still call this legacy signature. Keep it available during rollout,
-- but force every legacy regeneration into manual review. A later migration
-- may revoke this wrapper after all application instances use the context RPC.
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
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT finish_youtube_reply_regeneration_with_context(
    p_connection_id,
    p_queue_id,
    p_lock_token,
    p_run_id,
    p_draft,
    p_category,
    p_confidence,
    p_skip,
    true,
    'Regenerated by a legacy application instance; factual grounding requires review.',
    '{}'::uuid[]
  );
$$;

REVOKE ALL ON FUNCTION finish_youtube_reply_regeneration(
  uuid, uuid, uuid, uuid, text, text, numeric, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finish_youtube_reply_regeneration(
  uuid, uuid, uuid, uuid, text, text, numeric, boolean
) TO service_role;

-- Context-uncertain drafts are never eligible for unattended publishing.
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
      AND queue.requires_manual_review = false
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

      IF reserved_connection IS NULL THEN CONTINUE; END IF;
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

REVOKE ALL ON FUNCTION claim_youtube_publish_items(integer, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_youtube_publish_items(integer, text, integer) TO service_role;

COMMENT ON TABLE knowledge_bases IS
  'Provider-neutral owner knowledge used to ground generated replies. OAuth credentials are never stored here.';
COMMENT ON TABLE knowledge_entries IS
  'Structured FAQs, facts, and provider-scoped context. External source fields are untrusted grounding data.';
COMMENT ON COLUMN youtube_comment_queue.requires_manual_review IS
  'Defaults true for conservative review. New generation explicitly resolves it; automatic publish claims reject true rows.';
