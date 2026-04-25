-- Add cuisine type to restaurants
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS cuisine_type text;

-- Add rich detail columns to competitors
ALTER TABLE competitors
  ADD COLUMN IF NOT EXISTS website      text,
  ADD COLUMN IF NOT EXISTS price_level  int,
  ADD COLUMN IF NOT EXISTS cuisine_tags text[];
