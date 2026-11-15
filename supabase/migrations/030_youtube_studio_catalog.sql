-- Phase 6D: cached YouTube Studio-style channel, video, and playlist catalog.
-- Review and apply manually. This migration is independent of parked migration 026
-- and the Google Business schema in migration 029. It does not fetch Google data,
-- alter OAuth credentials, reset Reply Queue state, or enable publishing.

-- Enables channel-bound catalog foreign keys without modifying the applied
-- youtube_connections migration. The existing primary key already guarantees
-- uniqueness; the explicit pair is required as a composite FK target.
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'youtube_connections'::regclass
      AND conname = 'youtube_connections_id_channel_unique'
  ) THEN
    ALTER TABLE youtube_connections
      ADD CONSTRAINT youtube_connections_id_channel_unique UNIQUE (id, channel_id);
  END IF;
END
$migration$;

CREATE TABLE IF NOT EXISTS youtube_channel_profiles (
  connection_id uuid NOT NULL,
  channel_id text NOT NULL,
  title text NOT NULL,
  avatar_url text,
  channel_url text NOT NULL,
  uploads_playlist_id text NOT NULL,
  subscriber_count bigint,
  video_count bigint,
  view_count bigint,
  subscriber_count_hidden boolean NOT NULL DEFAULT false,
  catalog_partial boolean NOT NULL DEFAULT false,
  synced_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT youtube_channel_profiles_pkey PRIMARY KEY (connection_id),
  CONSTRAINT youtube_channel_profiles_connection_channel_fk
    FOREIGN KEY (connection_id, channel_id)
    REFERENCES youtube_connections(id, channel_id) ON DELETE CASCADE,
  CONSTRAINT youtube_channel_profiles_channel_format
    CHECK (channel_id ~ '^[A-Za-z0-9_-]{1,200}$'),
  CONSTRAINT youtube_channel_profiles_uploads_format
    CHECK (uploads_playlist_id ~ '^[A-Za-z0-9_-]{1,200}$'),
  CONSTRAINT youtube_channel_profiles_title_length
    CHECK (char_length(trim(title)) BETWEEN 1 AND 300),
  CONSTRAINT youtube_channel_profiles_avatar_length
    CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 2048),
  CONSTRAINT youtube_channel_profiles_url_length
    CHECK (char_length(channel_url) <= 2048),
  CONSTRAINT youtube_channel_profiles_counts
    CHECK (
      (subscriber_count IS NULL OR subscriber_count >= 0)
      AND (video_count IS NULL OR video_count >= 0)
      AND (view_count IS NULL OR view_count >= 0)
    )
);

CREATE TABLE IF NOT EXISTS youtube_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL,
  video_id text NOT NULL,
  channel_id text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  thumbnail_url text,
  published_at timestamptz,
  view_count bigint,
  comment_count bigint,
  privacy_status text,
  upload_position integer,
  is_available boolean NOT NULL DEFAULT true,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT youtube_videos_connection_id_id_unique UNIQUE (connection_id, id),
  CONSTRAINT youtube_videos_connection_video_unique UNIQUE (connection_id, video_id),
  CONSTRAINT youtube_videos_connection_channel_fk
    FOREIGN KEY (connection_id, channel_id)
    REFERENCES youtube_connections(id, channel_id) ON DELETE CASCADE,
  CONSTRAINT youtube_videos_video_format CHECK (video_id ~ '^[A-Za-z0-9_-]{1,200}$'),
  CONSTRAINT youtube_videos_channel_format CHECK (channel_id ~ '^[A-Za-z0-9_-]{1,200}$'),
  CONSTRAINT youtube_videos_title_length CHECK (char_length(trim(title)) BETWEEN 1 AND 500),
  CONSTRAINT youtube_videos_description_length CHECK (char_length(description) <= 5000),
  CONSTRAINT youtube_videos_thumbnail_length
    CHECK (thumbnail_url IS NULL OR char_length(thumbnail_url) <= 2048),
  CONSTRAINT youtube_videos_counts
    CHECK (
      (view_count IS NULL OR view_count >= 0)
      AND (comment_count IS NULL OR comment_count >= 0)
      AND (upload_position IS NULL OR upload_position >= 0)
    ),
  CONSTRAINT youtube_videos_privacy
    CHECK (privacy_status IS NULL OR privacy_status IN ('public', 'unlisted', 'private'))
);

CREATE TABLE IF NOT EXISTS youtube_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL,
  playlist_id text NOT NULL,
  channel_id text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  thumbnail_url text,
  published_at timestamptz,
  item_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  membership_complete boolean NOT NULL DEFAULT true,
  membership_synced_at timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT youtube_playlists_connection_id_id_unique UNIQUE (connection_id, id),
  CONSTRAINT youtube_playlists_connection_playlist_unique UNIQUE (connection_id, playlist_id),
  CONSTRAINT youtube_playlists_connection_channel_fk
    FOREIGN KEY (connection_id, channel_id)
    REFERENCES youtube_connections(id, channel_id) ON DELETE CASCADE,
  CONSTRAINT youtube_playlists_playlist_format CHECK (playlist_id ~ '^[A-Za-z0-9_-]{1,200}$'),
  CONSTRAINT youtube_playlists_channel_format CHECK (channel_id ~ '^[A-Za-z0-9_-]{1,200}$'),
  CONSTRAINT youtube_playlists_title_length CHECK (char_length(trim(title)) BETWEEN 1 AND 500),
  CONSTRAINT youtube_playlists_description_length CHECK (char_length(description) <= 5000),
  CONSTRAINT youtube_playlists_thumbnail_length
    CHECK (thumbnail_url IS NULL OR char_length(thumbnail_url) <= 2048),
  CONSTRAINT youtube_playlists_item_count CHECK (item_count >= 0)
);

CREATE TABLE IF NOT EXISTS youtube_playlist_videos (
  connection_id uuid NOT NULL,
  playlist_id uuid NOT NULL,
  video_id uuid NOT NULL,
  position integer NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (playlist_id, video_id),
  CONSTRAINT youtube_playlist_videos_playlist_connection_fk
    FOREIGN KEY (connection_id, playlist_id)
    REFERENCES youtube_playlists(connection_id, id) ON DELETE CASCADE,
  CONSTRAINT youtube_playlist_videos_video_connection_fk
    FOREIGN KEY (connection_id, video_id)
    REFERENCES youtube_videos(connection_id, id) ON DELETE CASCADE,
  CONSTRAINT youtube_playlist_videos_position CHECK (position >= 0)
);

CREATE INDEX IF NOT EXISTS youtube_videos_connection_published
  ON youtube_videos (connection_id, published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS youtube_playlists_connection_published
  ON youtube_playlists (connection_id, published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS youtube_playlist_videos_order
  ON youtube_playlist_videos (connection_id, playlist_id, position);

CREATE OR REPLACE FUNCTION replace_youtube_playlist_memberships(
  p_connection_id uuid,
  p_playlist_external_id text,
  p_memberships jsonb,
  p_membership_complete boolean,
  p_refreshed_at timestamptz
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_playlist_id uuid;
  target_membership_synced_at timestamptz;
  saved_count integer := 0;
BEGIN
  IF p_connection_id IS NULL
    OR p_playlist_external_id IS NULL
    OR p_playlist_external_id !~ '^[A-Za-z0-9_-]{1,200}$'
    OR p_memberships IS NULL
    OR jsonb_typeof(p_memberships) <> 'array'
    OR jsonb_array_length(p_memberships) > 500
    OR p_membership_complete IS NULL
    OR p_refreshed_at IS NULL
    OR p_refreshed_at > now() + interval '5 minutes'
  THEN
    RAISE EXCEPTION 'invalid_youtube_playlist_memberships';
  END IF;

  SELECT id, membership_synced_at
  INTO target_playlist_id, target_membership_synced_at
  FROM youtube_playlists
  WHERE connection_id = p_connection_id
    AND playlist_id = p_playlist_external_id
  FOR UPDATE;

  IF target_playlist_id IS NULL THEN
    RAISE EXCEPTION 'youtube_playlist_not_found';
  END IF;

  -- The playlist row lock serializes replacements. The independent watermark
  -- prevents a slower, older refresh from overwriting a newer generation.
  IF target_membership_synced_at IS NOT NULL AND p_refreshed_at <= target_membership_synced_at THEN
    RETURN 0;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_memberships) AS item(value)
    WHERE jsonb_typeof(item.value) <> 'object'
      OR COALESCE(item.value->>'video_id', '') !~ '^[A-Za-z0-9_-]{1,200}$'
      OR COALESCE(item.value->>'position', '') !~ '^\d{1,9}$'
  ) THEN
    RAISE EXCEPTION 'invalid_youtube_playlist_membership_item';
  END IF;

  -- Partial indexes are additive only. They can update known positions and add
  -- newly observed videos, but can never erase previously valid memberships.
  IF p_membership_complete THEN
    DELETE FROM youtube_playlist_videos
    WHERE connection_id = p_connection_id
      AND playlist_id = target_playlist_id;
  END IF;

  WITH parsed_memberships AS (
    SELECT DISTINCT ON (item.value->>'video_id')
      item.value->>'video_id' AS external_video_id,
      (item.value->>'position')::integer AS position
    FROM jsonb_array_elements(p_memberships) AS item(value)
    ORDER BY item.value->>'video_id', (item.value->>'position')::integer
  )
  INSERT INTO youtube_playlist_videos (connection_id, playlist_id, video_id, position, synced_at)
  SELECT
    p_connection_id,
    target_playlist_id,
    video.id,
    membership.position,
    p_refreshed_at
  FROM parsed_memberships AS membership
  JOIN youtube_videos AS video
    ON video.connection_id = p_connection_id
   AND video.video_id = membership.external_video_id
   AND video.channel_id = (
     SELECT connection.channel_id
     FROM youtube_connections AS connection
     WHERE connection.id = p_connection_id
   )
  ON CONFLICT (playlist_id, video_id) DO UPDATE
  SET position = EXCLUDED.position, synced_at = EXCLUDED.synced_at;

  GET DIAGNOSTICS saved_count = ROW_COUNT;

  UPDATE youtube_playlists
  SET membership_complete = p_membership_complete,
      membership_synced_at = p_refreshed_at
  WHERE connection_id = p_connection_id
    AND id = target_playlist_id;

  RETURN saved_count;
END;
$$;

ALTER TABLE youtube_channel_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_playlist_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "youtube channel profile owner select" ON youtube_channel_profiles;
CREATE POLICY "youtube channel profile owner select"
  ON youtube_channel_profiles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM youtube_connections AS connection
    WHERE connection.id = youtube_channel_profiles.connection_id
      AND connection.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "youtube video owner select" ON youtube_videos;
CREATE POLICY "youtube video owner select"
  ON youtube_videos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM youtube_connections AS connection
    WHERE connection.id = youtube_videos.connection_id
      AND connection.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "youtube playlist owner select" ON youtube_playlists;
CREATE POLICY "youtube playlist owner select"
  ON youtube_playlists FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM youtube_connections AS connection
    WHERE connection.id = youtube_playlists.connection_id
      AND connection.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "youtube playlist membership owner select" ON youtube_playlist_videos;
CREATE POLICY "youtube playlist membership owner select"
  ON youtube_playlist_videos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM youtube_connections AS connection
    WHERE connection.id = youtube_playlist_videos.connection_id
      AND connection.user_id = auth.uid()
  ));

REVOKE ALL ON TABLE youtube_channel_profiles FROM anon, authenticated;
REVOKE ALL ON TABLE youtube_videos FROM anon, authenticated;
REVOKE ALL ON TABLE youtube_playlists FROM anon, authenticated;
REVOKE ALL ON TABLE youtube_playlist_videos FROM anon, authenticated;
GRANT SELECT ON TABLE youtube_channel_profiles TO authenticated;
GRANT SELECT ON TABLE youtube_videos TO authenticated;
GRANT SELECT ON TABLE youtube_playlists TO authenticated;
GRANT SELECT ON TABLE youtube_playlist_videos TO authenticated;
GRANT ALL ON TABLE youtube_channel_profiles TO service_role;
GRANT ALL ON TABLE youtube_videos TO service_role;
GRANT ALL ON TABLE youtube_playlists TO service_role;
GRANT ALL ON TABLE youtube_playlist_videos TO service_role;

REVOKE ALL ON FUNCTION replace_youtube_playlist_memberships(uuid, text, jsonb, boolean, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION replace_youtube_playlist_memberships(uuid, text, jsonb, boolean, timestamptz) TO service_role;

COMMENT ON TABLE youtube_videos IS
  'Canonical per-connection YouTube video metadata. Reply Queue state remains in youtube_comment_queue.';
COMMENT ON TABLE youtube_playlists IS
  'Owned YouTube playlists cached for creator navigation. The uploads playlist is represented by All Videos.';
COMMENT ON TABLE youtube_playlist_videos IS
  'Connection-bound owned-video playlist membership in YouTube order. Composite foreign keys make cross-connection associations impossible.';
