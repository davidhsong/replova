ALTER TABLE reputation_scores
  ADD COLUMN IF NOT EXISTS rating_score   numeric,
  ADD COLUMN IF NOT EXISTS volume_score   numeric,
  ADD COLUMN IF NOT EXISTS response_score numeric,
  ADD COLUMN IF NOT EXISTS sentiment_score numeric;
