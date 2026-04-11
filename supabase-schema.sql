create table restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  place_id text not null unique,
  owner_email text not null,
  active boolean default false,
  stripe_customer_id text,
  google_access_token text,
  google_refresh_token text,
  google_token_expires_at bigint,
  google_location_name text,
  created_at timestamptz default now()
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  author text,
  rating integer check (rating between 1 and 5),
  review_text text,
  review_timestamp bigint,
  reply_draft_1 text,
  reply_draft_2 text,
  reply_draft_3 text,
  status text default 'pending',
  google_review_name text,
  replied_at timestamptz,
  created_at timestamptz default now(),
  unique(restaurant_id, review_timestamp)
);

-- Run these ALTER statements on an existing database:
-- alter table restaurants add column if not exists google_access_token text;
-- alter table restaurants add column if not exists google_refresh_token text;
-- alter table restaurants add column if not exists google_token_expires_at bigint;
-- alter table restaurants add column if not exists google_location_name text;
-- alter table reviews add column if not exists google_review_name text;
-- alter table reviews add column if not exists replied_at timestamptz;
