-- Add terms_accepted_at to accounts.
-- NULL means the user has not yet accepted; non-NULL stores the timestamp they did.
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
