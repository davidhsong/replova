-- Required by Phase 2A so an unknown YouTube reply status can never be
-- mistaken for a verified-unpublished comment. Apply manually before using
-- the manual sync endpoint.

ALTER TABLE youtube_comment_queue
  ADD COLUMN IF NOT EXISTS reply_verification_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS reply_verification_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS reply_verification_error text;

ALTER TABLE youtube_comment_queue
  DROP CONSTRAINT IF EXISTS youtube_comment_queue_reply_verification_status;
ALTER TABLE youtube_comment_queue
  ADD CONSTRAINT youtube_comment_queue_reply_verification_status
  CHECK (reply_verification_status IN ('unknown', 'verified_unpublished', 'verified_published'));

CREATE INDEX IF NOT EXISTS youtube_comment_queue_reply_verification
  ON youtube_comment_queue (connection_id, reply_verification_status, processing_state);

COMMENT ON COLUMN youtube_comment_queue.reply_verification_status IS
  'Workers must never draft or publish unless this is verified_unpublished.';
