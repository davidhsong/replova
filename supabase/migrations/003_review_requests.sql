CREATE TABLE IF NOT EXISTS review_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_name   text,
  customer_email  text NOT NULL,
  customer_phone  text,
  channel         text NOT NULL DEFAULT 'email',
  status          text NOT NULL DEFAULT 'pending',
  sent_at         timestamptz,
  opened_at       timestamptz,
  clicked_at      timestamptz,
  review_link     text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_requests_restaurant_id_idx ON review_requests(restaurant_id);
CREATE INDEX IF NOT EXISTS review_requests_email_idx ON review_requests(customer_email);
CREATE INDEX IF NOT EXISTS review_requests_created_at_idx ON review_requests(created_at DESC);
