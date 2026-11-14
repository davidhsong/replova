-- Phase 5B: owner-controlled YouTube auto-publish policy and consent.
-- This migration does not schedule or perform publishing. It deliberately
-- removes service-role access to the legacy unattended publish claim.

ALTER TABLE youtube_automation_settings
  ADD COLUMN IF NOT EXISTS publishing_mode text NOT NULL DEFAULT 'manual_approval',
  ADD COLUMN IF NOT EXISTS emergency_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commenter_cooldown_hours integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS eligible_video_filter_mode text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS eligible_video_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS auto_publish_consent_scope_hash text;

CREATE OR REPLACE FUNCTION valid_youtube_category_rules(p_rules jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_typeof(p_rules) = 'object'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_each_text(p_rules) AS rule(category, action)
      WHERE category NOT IN (
        'praise', 'thanks', 'neutral_feedback', 'question', 'complaint',
        'negative_feedback', 'other', 'spam'
      )
      OR action NOT IN ('auto_publish', 'manual_review', 'skip')
      OR (category = 'spam' AND action <> 'skip')
    );
$$;

CREATE OR REPLACE FUNCTION valid_youtube_video_filter(
  p_mode text,
  p_video_ids text[]
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_mode IN ('all', 'include', 'exclude')
    AND cardinality(p_video_ids) <= 100
    AND NOT EXISTS (
      SELECT 1 FROM unnest(p_video_ids) AS video_id
      WHERE video_id IS NULL OR video_id !~ '^[A-Za-z0-9_-]{1,200}$'
    )
    AND (
      (p_mode = 'all' AND cardinality(p_video_ids) = 0)
      OR (p_mode IN ('include', 'exclude') AND cardinality(p_video_ids) > 0)
    );
$$;

ALTER TABLE youtube_automation_settings
  DROP CONSTRAINT IF EXISTS youtube_automation_settings_publishing_mode,
  DROP CONSTRAINT IF EXISTS youtube_automation_settings_commenter_cooldown,
  DROP CONSTRAINT IF EXISTS youtube_automation_settings_video_filter_mode,
  DROP CONSTRAINT IF EXISTS youtube_automation_settings_video_filter_ids,
  DROP CONSTRAINT IF EXISTS youtube_automation_settings_consent_scope_hash,
  DROP CONSTRAINT IF EXISTS youtube_automation_settings_category_rules_shape;

ALTER TABLE youtube_automation_settings
  ADD CONSTRAINT youtube_automation_settings_publishing_mode
    CHECK (publishing_mode IN ('manual_approval', 'auto_publish')),
  ADD CONSTRAINT youtube_automation_settings_commenter_cooldown
    CHECK (commenter_cooldown_hours BETWEEN 0 AND 8760),
  ADD CONSTRAINT youtube_automation_settings_video_filter_mode
    CHECK (eligible_video_filter_mode IN ('all', 'include', 'exclude')),
  ADD CONSTRAINT youtube_automation_settings_video_filter_ids
    CHECK (valid_youtube_video_filter(eligible_video_filter_mode, eligible_video_ids)),
  ADD CONSTRAINT youtube_automation_settings_consent_scope_hash
    CHECK (
      auto_publish_consent_scope_hash IS NULL
      OR auto_publish_consent_scope_hash ~ '^[0-9a-f]{64}$'
    );

ALTER TABLE youtube_automation_settings
  ALTER COLUMN category_rules SET DEFAULT '{
    "praise":"auto_publish",
    "thanks":"auto_publish",
    "neutral_feedback":"manual_review",
    "question":"manual_review",
    "complaint":"manual_review",
    "negative_feedback":"manual_review",
    "other":"manual_review",
    "spam":"skip"
  }'::jsonb;

-- The new policy scope requires fresh consent. Runtime publishing remains off.
UPDATE youtube_automation_settings
SET
  auto_publish_enabled = false,
  publishing_mode = 'manual_approval',
  auto_publish_revoked_at = CASE
    WHEN auto_publish_authorized_at IS NOT NULL THEN COALESCE(auto_publish_revoked_at, now())
    ELSE auto_publish_revoked_at
  END,
  category_rules = jsonb_build_object(
    'praise', CASE WHEN category_rules->>'praise' IN ('auto_publish', 'manual_review', 'skip')
      THEN category_rules->>'praise' ELSE 'auto_publish' END,
    'thanks', CASE WHEN category_rules->>'thanks' IN ('auto_publish', 'manual_review', 'skip')
      THEN category_rules->>'thanks' ELSE 'auto_publish' END,
    'neutral_feedback', CASE
      WHEN category_rules->>'neutral_feedback' IN ('auto_publish', 'manual_review', 'skip')
        THEN category_rules->>'neutral_feedback'
      WHEN category_rules->>'feedback' IN ('auto_publish', 'manual_review', 'skip')
        THEN category_rules->>'feedback'
      ELSE 'manual_review' END,
    'question', CASE WHEN category_rules->>'question' IN ('auto_publish', 'manual_review', 'skip')
      THEN category_rules->>'question' ELSE 'manual_review' END,
    'complaint', CASE WHEN category_rules->>'complaint' IN ('auto_publish', 'manual_review', 'skip')
      THEN category_rules->>'complaint' ELSE 'manual_review' END,
    'negative_feedback', CASE WHEN category_rules->>'negative_feedback' IN ('auto_publish', 'manual_review', 'skip')
      THEN category_rules->>'negative_feedback' ELSE 'manual_review' END,
    'other', CASE
      WHEN category_rules->>'other' IN ('auto_publish', 'manual_review', 'skip')
        THEN category_rules->>'other'
      WHEN category_rules->>'other_legitimate' IN ('auto_publish', 'manual_review', 'skip')
        THEN category_rules->>'other_legitimate'
      ELSE 'manual_review' END,
    'spam', 'skip'
  );

ALTER TABLE youtube_automation_settings
  ADD CONSTRAINT youtube_automation_settings_category_rules_shape
  CHECK (valid_youtube_category_rules(category_rules));

ALTER TABLE youtube_automation_logs
  DROP CONSTRAINT IF EXISTS youtube_automation_logs_event_type;
ALTER TABLE youtube_automation_logs
  ADD CONSTRAINT youtube_automation_logs_event_type
  CHECK (event_type IN (
    'sync_started', 'sync_succeeded', 'sync_failed', 'comment_discovered',
    'draft_started', 'draft_succeeded', 'draft_failed', 'draft_edited',
    'approval_changed', 'publish_attempted', 'publish_succeeded',
    'publish_failed', 'publish_uncertain', 'worker_lease_expired',
    'settings_updated', 'consent_granted', 'consent_revoked',
    'consent_invalidated', 'automation_paused', 'automation_resumed'
  ));

CREATE OR REPLACE FUNCTION youtube_auto_publish_scope_hash(
  p_category_rules jsonb,
  p_max_daily integer,
  p_min_confidence numeric,
  p_delay_minutes integer,
  p_cooldown_hours integer,
  p_video_filter_mode text,
  p_video_ids text[]
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT pg_catalog.encode(
    pg_catalog.sha256(
      convert_to(
        jsonb_build_object(
          'category_rules', p_category_rules,
          'max_daily', p_max_daily,
          'min_confidence', round(p_min_confidence, 3),
          'delay_minutes', p_delay_minutes,
          'cooldown_hours', p_cooldown_hours,
          'video_filter_mode', p_video_filter_mode,
          'video_ids', to_jsonb(ARRAY(SELECT value FROM unnest(p_video_ids) AS value ORDER BY value))
        )::text,
        'UTF8'
      )
    ),
    'hex'
  );
$$;

CREATE OR REPLACE FUNCTION invalidate_youtube_auto_publish_consent_on_scope_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_hash text;
  new_hash text;
BEGIN
  old_hash := youtube_auto_publish_scope_hash(
    OLD.category_rules, OLD.max_auto_publishes_per_day,
    OLD.min_auto_publish_confidence, OLD.reply_delay_minutes,
    OLD.commenter_cooldown_hours, OLD.eligible_video_filter_mode,
    OLD.eligible_video_ids
  );
  new_hash := youtube_auto_publish_scope_hash(
    NEW.category_rules, NEW.max_auto_publishes_per_day,
    NEW.min_auto_publish_confidence, NEW.reply_delay_minutes,
    NEW.commenter_cooldown_hours, NEW.eligible_video_filter_mode,
    NEW.eligible_video_ids
  );

  IF old_hash IS DISTINCT FROM new_hash
     AND OLD.auto_publish_authorized_at IS NOT NULL
     AND OLD.auto_publish_revoked_at IS NULL THEN
    NEW.auto_publish_enabled := false;
    NEW.publishing_mode := 'manual_approval';
    NEW.auto_publish_revoked_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS youtube_automation_settings_10_invalidate_scope
  ON youtube_automation_settings;
CREATE TRIGGER youtube_automation_settings_10_invalidate_scope
BEFORE UPDATE ON youtube_automation_settings
FOR EACH ROW EXECUTE FUNCTION invalidate_youtube_auto_publish_consent_on_scope_change();

CREATE OR REPLACE FUNCTION validate_youtube_auto_publish_consent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  connection_owner uuid;
  current_scope_hash text;
BEGIN
  SELECT user_id INTO connection_owner
  FROM youtube_connections
  WHERE id = NEW.connection_id;
  IF connection_owner IS NULL THEN RAISE EXCEPTION 'youtube_connection_not_found'; END IF;
  IF NEW.auto_publish_authorized_by IS NOT NULL
     AND NEW.auto_publish_authorized_by <> connection_owner THEN
    RAISE EXCEPTION 'auto_publish_consent_owner_mismatch';
  END IF;

  current_scope_hash := youtube_auto_publish_scope_hash(
    NEW.category_rules, NEW.max_auto_publishes_per_day,
    NEW.min_auto_publish_confidence, NEW.reply_delay_minutes,
    NEW.commenter_cooldown_hours, NEW.eligible_video_filter_mode,
    NEW.eligible_video_ids
  );

  IF NEW.publishing_mode = 'auto_publish' AND (
    NEW.auto_publish_authorized_at IS NULL
    OR NEW.auto_publish_authorized_by <> connection_owner
    OR NEW.auto_publish_consent_version <> 'youtube-auto-publish-v1'
    OR NEW.auto_publish_consent_scope_hash IS DISTINCT FROM current_scope_hash
    OR NEW.auto_publish_revoked_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'current_owner_consent_required';
  END IF;

  IF NEW.auto_publish_enabled AND (
    NEW.publishing_mode <> 'auto_publish'
    OR NEW.emergency_paused
    OR NEW.auto_publish_authorized_at IS NULL
    OR NEW.auto_publish_authorized_by <> connection_owner
    OR NEW.auto_publish_consent_version <> 'youtube-auto-publish-v1'
    OR NEW.auto_publish_consent_scope_hash IS DISTINCT FROM current_scope_hash
    OR NEW.auto_publish_revoked_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'valid_current_owner_consent_required';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_youtube_auto_publish_policy(
  p_connection_id uuid,
  p_owner_id uuid,
  p_expected_updated_at timestamptz,
  p_category_rules jsonb,
  p_max_daily integer,
  p_min_confidence numeric,
  p_delay_minutes integer,
  p_cooldown_hours integer,
  p_video_filter_mode text,
  p_video_ids text[]
)
RETURNS youtube_automation_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item youtube_automation_settings%ROWTYPE;
  had_current_consent boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM youtube_connections WHERE id = p_connection_id AND user_id = p_owner_id
  ) THEN RAISE EXCEPTION 'youtube_connection_owner_mismatch'; END IF;

  INSERT INTO youtube_automation_settings (connection_id)
  VALUES (p_connection_id) ON CONFLICT (connection_id) DO NOTHING;
  SELECT * INTO item FROM youtube_automation_settings
  WHERE connection_id = p_connection_id FOR UPDATE;
  IF p_expected_updated_at IS NULL OR item.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION 'settings_conflict';
  END IF;
  had_current_consent := item.auto_publish_authorized_at IS NOT NULL
    AND item.auto_publish_revoked_at IS NULL;

  UPDATE youtube_automation_settings SET
    category_rules = p_category_rules,
    max_auto_publishes_per_day = p_max_daily,
    min_auto_publish_confidence = p_min_confidence,
    reply_delay_minutes = p_delay_minutes,
    commenter_cooldown_hours = p_cooldown_hours,
    eligible_video_filter_mode = p_video_filter_mode,
    eligible_video_ids = p_video_ids,
    auto_publish_enabled = false
  WHERE connection_id = p_connection_id
  RETURNING * INTO item;

  INSERT INTO youtube_automation_logs (
    connection_id, event_type, severity, message, metadata
  ) VALUES (
    p_connection_id,
    CASE WHEN had_current_consent AND item.auto_publish_revoked_at IS NOT NULL
      THEN 'consent_invalidated' ELSE 'settings_updated' END,
    'info',
    CASE WHEN had_current_consent AND item.auto_publish_revoked_at IS NOT NULL
      THEN 'YouTube auto-publish consent invalidated by a material policy change.'
      ELSE 'YouTube auto-publish policy updated.' END,
    jsonb_build_object(
      'publishing_mode', item.publishing_mode,
      'max_daily', item.max_auto_publishes_per_day,
      'min_confidence', item.min_auto_publish_confidence,
      'delay_minutes', item.reply_delay_minutes,
      'cooldown_hours', item.commenter_cooldown_hours,
      'video_filter_mode', item.eligible_video_filter_mode,
      'video_id_count', cardinality(item.eligible_video_ids)
    )
  );
  RETURN item;
END;
$$;

CREATE OR REPLACE FUNCTION grant_youtube_auto_publish_consent(
  p_connection_id uuid,
  p_owner_id uuid,
  p_consent_version text
)
RETURNS youtube_automation_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item youtube_automation_settings%ROWTYPE;
  scope_hash text;
BEGIN
  IF p_consent_version <> 'youtube-auto-publish-v1' THEN
    RAISE EXCEPTION 'unsupported_consent_version';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM youtube_connections WHERE id = p_connection_id AND user_id = p_owner_id
  ) THEN RAISE EXCEPTION 'youtube_connection_owner_mismatch'; END IF;

  INSERT INTO youtube_automation_settings (connection_id)
  VALUES (p_connection_id) ON CONFLICT (connection_id) DO NOTHING;
  SELECT * INTO item FROM youtube_automation_settings
  WHERE connection_id = p_connection_id FOR UPDATE;
  scope_hash := youtube_auto_publish_scope_hash(
    item.category_rules, item.max_auto_publishes_per_day,
    item.min_auto_publish_confidence, item.reply_delay_minutes,
    item.commenter_cooldown_hours, item.eligible_video_filter_mode,
    item.eligible_video_ids
  );

  UPDATE youtube_automation_settings SET
    publishing_mode = 'auto_publish',
    auto_publish_enabled = false,
    auto_publish_authorized_at = now(),
    auto_publish_authorized_by = p_owner_id,
    auto_publish_consent_version = p_consent_version,
    auto_publish_consent_scope_hash = scope_hash,
    auto_publish_revoked_at = NULL
  WHERE connection_id = p_connection_id RETURNING * INTO item;

  INSERT INTO youtube_automation_logs (
    connection_id, event_type, severity, message, metadata
  ) VALUES (
    p_connection_id, 'consent_granted', 'info',
    'Owner consent recorded for the current YouTube auto-publish policy.',
    jsonb_build_object('consent_version', p_consent_version, 'runtime_enabled', false)
  );
  RETURN item;
END;
$$;

CREATE OR REPLACE FUNCTION revoke_youtube_auto_publish_consent(
  p_connection_id uuid,
  p_owner_id uuid
)
RETURNS youtube_automation_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE item youtube_automation_settings%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM youtube_connections WHERE id = p_connection_id AND user_id = p_owner_id
  ) THEN RAISE EXCEPTION 'youtube_connection_owner_mismatch'; END IF;
  UPDATE youtube_automation_settings SET
    publishing_mode = 'manual_approval',
    auto_publish_enabled = false,
    auto_publish_revoked_at = now()
  WHERE connection_id = p_connection_id RETURNING * INTO item;
  IF NOT FOUND THEN RAISE EXCEPTION 'youtube_settings_not_found'; END IF;
  INSERT INTO youtube_automation_logs (
    connection_id, event_type, severity, message, metadata
  ) VALUES (
    p_connection_id, 'consent_revoked', 'info',
    'Owner revoked YouTube auto-publish consent.', '{}'::jsonb
  );
  RETURN item;
END;
$$;

CREATE OR REPLACE FUNCTION set_youtube_automation_emergency_pause(
  p_connection_id uuid,
  p_owner_id uuid,
  p_paused boolean
)
RETURNS youtube_automation_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE item youtube_automation_settings%ROWTYPE;
BEGIN
  IF p_paused IS NULL THEN RAISE EXCEPTION 'pause_value_required'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM youtube_connections WHERE id = p_connection_id AND user_id = p_owner_id
  ) THEN RAISE EXCEPTION 'youtube_connection_owner_mismatch'; END IF;
  INSERT INTO youtube_automation_settings (connection_id)
  VALUES (p_connection_id) ON CONFLICT (connection_id) DO NOTHING;
  UPDATE youtube_automation_settings SET
    emergency_paused = p_paused,
    auto_publish_enabled = false
  WHERE connection_id = p_connection_id RETURNING * INTO item;
  INSERT INTO youtube_automation_logs (
    connection_id, event_type, severity, message, metadata
  ) VALUES (
    p_connection_id,
    CASE WHEN p_paused THEN 'automation_paused' ELSE 'automation_resumed' END,
    'info',
    CASE WHEN p_paused THEN 'YouTube automation emergency pause enabled.'
      ELSE 'YouTube automation emergency pause cleared; publishing remains disabled.' END,
    jsonb_build_object('runtime_enabled', false)
  );
  RETURN item;
END;
$$;

REVOKE ALL ON FUNCTION youtube_auto_publish_scope_hash(jsonb, integer, numeric, integer, integer, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION valid_youtube_category_rules(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION valid_youtube_video_filter(text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION invalidate_youtube_auto_publish_consent_on_scope_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION update_youtube_auto_publish_policy(uuid, uuid, timestamptz, jsonb, integer, numeric, integer, integer, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION grant_youtube_auto_publish_consent(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION revoke_youtube_auto_publish_consent(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_youtube_automation_emergency_pause(uuid, uuid, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION youtube_auto_publish_scope_hash(jsonb, integer, numeric, integer, integer, text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION valid_youtube_category_rules(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION valid_youtube_video_filter(text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION invalidate_youtube_auto_publish_consent_on_scope_change() TO service_role;
GRANT EXECUTE ON FUNCTION update_youtube_auto_publish_policy(uuid, uuid, timestamptz, jsonb, integer, numeric, integer, integer, text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION grant_youtube_auto_publish_consent(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION revoke_youtube_auto_publish_consent(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION set_youtube_automation_emergency_pause(uuid, uuid, boolean) TO service_role;

-- Phase 5B evaluates policy only. No unattended publisher may claim work yet.
REVOKE EXECUTE ON FUNCTION claim_youtube_publish_items(integer, text, integer) FROM service_role;

COMMENT ON COLUMN youtube_automation_settings.publishing_mode IS
  'Owner-selected policy mode. Auto-publish still requires current consent and a future runtime enablement migration.';
COMMENT ON COLUMN youtube_automation_settings.emergency_paused IS
  'Immediate owner kill switch. Clearing it never enables publishing.';
COMMENT ON COLUMN youtube_automation_settings.auto_publish_consent_scope_hash IS
  'Server-computed hash of material policy fields covered by explicit owner consent.';
