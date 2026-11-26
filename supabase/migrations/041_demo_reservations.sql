create table public.demo_reservations (
  starts_at timestamptz primary key,
  request_id uuid not null unique,
  delivered boolean not null default false
);
alter table public.demo_reservations enable row level security;
revoke all on public.demo_reservations from public, anon, authenticated;
grant select, insert, update, delete on public.demo_reservations to service_role;
