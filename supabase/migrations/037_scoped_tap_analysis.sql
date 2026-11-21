begin;

-- Only database operators can change the activation window or its claim budget.
create table public.tap_analysis_locations (
  location_id uuid primary key references public.restaurants(id) on delete cascade,
  enabled_from timestamptz not null default clock_timestamp(),
  remaining_claims integer check (remaining_claims >= 0)
);
alter table public.tap_analysis_locations enable row level security;
revoke all on public.tap_analysis_locations from public, anon, authenticated, service_role;
grant select, update (remaining_claims) on public.tap_analysis_locations to service_role;
alter table public.tap_feedback add column analysis_receipt jsonb;
-- The due-time-only index must traverse older jobs at excluded sites.
create index tap_feedback_location_due_idx on public.tap_feedback(location_id,next_attempt,id)
where analysis_status<>'ready' and attempts<6;

-- During rolling deployment an older binary must never acquire a paid lease.
create or replace function public.tap_claim_analysis() returns setof public.tap_feedback
language sql set search_path='' as $$
  select f.* from public.tap_feedback f where false
$$;

create function public.tap_claim_scoped_analysis() returns setof public.tap_feedback
language plpgsql set search_path='' as $$
declare site public.tap_analysis_locations; job uuid;
begin
  select a.* into site from public.tap_analysis_locations a
  join public.restaurants l on l.id=a.location_id and l.active
  cross join lateral (
    select f.next_attempt from public.tap_feedback f
    where f.location_id=a.location_id and f.created_at>=a.enabled_from
      and f.analysis_status<>'ready' and f.attempts<6 and f.next_attempt<=now()
    order by f.next_attempt,f.id limit 1
  ) due
  where a.remaining_claims is distinct from 0
  order by l.tap_last_claimed_at nulls first,due.next_attempt,l.id
  limit 1 for update of a skip locked;
  if not found then return; end if;

  select f.id into job from public.tap_feedback f
  where f.location_id=site.location_id and f.created_at>=site.enabled_from
    and f.analysis_status<>'ready' and f.attempts<6 and f.next_attempt<=now()
  order by f.next_attempt,f.id limit 1 for update skip locked;
  if not found then return; end if;

  if site.remaining_claims is not null then
    update public.tap_analysis_locations set remaining_claims=remaining_claims-1 where location_id=site.location_id;
  end if;
  update public.restaurants set tap_last_claimed_at=clock_timestamp() where id=site.location_id;
  return query update public.tap_feedback set lease=gen_random_uuid(),analysis_status='working',
    attempts=attempts+1,next_attempt=now()+interval '3 minutes' where id=job returning *;
end $$;

-- This is the dispatch authorization boundary. A reserved last claim can start at zero balance.
create function public.tap_analysis_can_start(p_id uuid,p_lease uuid) returns boolean
language sql set search_path='' as $$
  select exists(select 1 from public.tap_analysis_locations a
    join public.restaurants l on l.id=a.location_id and l.active
    join public.tap_feedback f on f.location_id=a.location_id and f.created_at>=a.enabled_from
    where f.id=p_id and f.lease=p_lease and f.analysis_status='working' and f.next_attempt>now()
    for share of a,l,f)
$$;

create function public.tap_retry_analysis(p_location uuid,p_id uuid) returns void
language sql set search_path='' as $$
  update public.tap_feedback f set analysis_status='pending',attempts=0,lease=null,next_attempt=now()
  from public.tap_analysis_locations a join public.restaurants l on l.id=a.location_id and l.active
  where a.location_id=p_location and f.location_id=a.location_id and f.id=p_id
    and f.analysis_status='failed' and f.created_at>=a.enabled_from and a.remaining_claims is distinct from 0
$$;

revoke all on function public.tap_claim_scoped_analysis(), public.tap_analysis_can_start(uuid,uuid),
  public.tap_retry_analysis(uuid,uuid) from public,anon,authenticated;
grant execute on function public.tap_claim_scoped_analysis(), public.tap_analysis_can_start(uuid,uuid),
  public.tap_retry_analysis(uuid,uuid) to service_role;
commit;
