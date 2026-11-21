begin;

-- One turn per location. The clock changes in the same transaction as the lease.
alter table public.restaurants add column tap_last_claimed_at timestamptz;
create or replace function public.tap_claim_analysis() returns setof public.tap_feedback
language plpgsql set search_path='' as $$
declare loc uuid; job uuid;
begin
 select l.id into loc from public.restaurants l
 join (select location_id,min(next_attempt) oldest from public.tap_feedback
       where analysis_status<>'ready' and attempts<6 and next_attempt<=now()
       group by location_id) due on due.location_id=l.id
 order by l.tap_last_claimed_at nulls first,due.oldest,l.id
 limit 1 for no key update of l skip locked;
 if loc is null then return; end if;

 select id into job from public.tap_feedback
 where location_id=loc and analysis_status<>'ready' and attempts<6 and next_attempt<=now()
 order by next_attempt,id limit 1 for update skip locked;
 if job is null then return; end if;
 update public.restaurants set tap_last_claimed_at=clock_timestamp() where id=loc;
 return query update public.tap_feedback set lease=gen_random_uuid(),analysis_status='working',
   attempts=attempts+1,next_attempt=now()+interval '3 minutes' where id=job returning *;
end $$;

create function public.tap_label(p_placard uuid) returns text language sql stable set search_path='' as $$
 select case when w.name is null or l.name=w.name or starts_with(l.name,w.name || ' · ')
   then l.name else w.name || ' · ' || l.name end
 from public.tap_placards p join public.restaurants l on l.id=p.location_id
 left join public.business_workspaces w on w.id=l.workspace_id
 where p.id=p_placard and p.revoked_at is null and l.active
$$;
revoke all on function public.tap_label(uuid) from public,anon,authenticated;
grant execute on function public.tap_label(uuid) to service_role;

create or replace function public.tap_open(p_placard uuid,p_test boolean)
returns table(encounter uuid,business text) language plpgsql set search_path='' as $$
declare ticket uuid;
begin
 perform 1 from public.tap_placards p join public.restaurants l on l.id=p.location_id
 where p.id=p_placard and p.revoked_at is null and l.active for share of p,l;
 if not found then return; end if;
 insert into public.tap_encounters(placard_id,is_test) values(p_placard,p_test) returning id into ticket;
 return query select ticket,public.tap_label(p_placard);
end $$;
commit;
