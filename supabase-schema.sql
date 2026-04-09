create table restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  place_id text not null unique,
  owner_email text not null,
  active boolean default false,
  stripe_customer_id text,
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
  created_at timestamptz default now(),
  unique(restaurant_id, review_timestamp)
);
