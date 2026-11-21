-- Private pilot data. All customer writes go through the encounter functions.
begin;
alter table public.restaurants add column pilot_timezone text not null default 'UTC';

create table public.tap_placards (
 id uuid primary key default gen_random_uuid(),
 location_id uuid not null references public.restaurants on delete cascade,
 placement text not null default '' check(length(placement)<=100),
 revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create index on public.tap_placards(location_id);
create table public.tap_encounters (
 id uuid primary key default gen_random_uuid(),
 placard_id uuid not null references public.tap_placards on delete cascade,
 expires_at timestamptz not null default (now()+interval '10 minutes'),
 is_test boolean not null,
 consumed boolean not null default false
);
create index on public.tap_encounters(expires_at);
create table public.tap_feedback (
 id uuid primary key,
 location_id uuid not null references public.restaurants on delete cascade,
 placard_id uuid not null references public.tap_placards on delete cascade,
 created_at timestamptz not null default now(),
 rating smallint not null check(rating between 1 and 5),
 comment text not null check(length(comment)<=2000),
 is_test boolean not null,
 analysis_status text not null check(analysis_status in ('pending','working','failed','ready')),
 lease uuid, next_attempt timestamptz not null default now(), attempts int not null default 0,
 sentiment text, urgent boolean not null default false,
 themes jsonb not null default '[]'
);
create index on public.tap_feedback(location_id,created_at desc);
create index on public.tap_feedback(next_attempt) where analysis_status <> 'ready';

create table public.issue_playbooks (
 id uuid primary key default gen_random_uuid(),
 location_id uuid not null references public.restaurants on delete cascade,
 quarter_start date not null,
 focus text not null default '',
 is_test boolean not null default false,
 theme text not null,
 snapshot jsonb not null,
 state jsonb not null default '{}',
 revision int not null default 0,
 next_work timestamptz,
 created_at timestamptz not null default now(),
 unique(location_id,quarter_start,is_test,focus)
);
create index on public.issue_playbooks(next_work) where next_work is not null;
create table public.issue_activity (
 id bigint generated always as identity primary key,
 run_id uuid not null references public.issue_playbooks on delete cascade,
 revision int not null,
 created_at timestamptz not null default now(),
 detail jsonb not null,
 unique(run_id,revision)
);

create function public.tap_open(p_placard uuid,p_test boolean) returns table(encounter uuid,business text)
language plpgsql set search_path = '' as $$
declare r record; ticket uuid;
begin
 select p.id,l.name into r from public.tap_placards p join public.restaurants l on l.id=p.location_id
 where p.id=p_placard and p.revoked_at is null and l.active for share of p,l;
 if not found then return; end if;
 insert into public.tap_encounters(placard_id,is_test) values(r.id,p_test) returning id into ticket;
 return query select ticket,r.name::text;
end $$;

create function public.tap_submit(p_placard uuid,p_encounter uuid,p_rating int,p_comment text) returns text
language plpgsql set search_path = '' as $$
declare loc uuid; e public.tap_encounters;
begin
 select l.id into loc from public.tap_placards p join public.restaurants l on l.id=p.location_id
 where p.id=p_placard and p.revoked_at is null and l.active for share of p,l;
 if not found then return 'closed'; end if;
 select * into e from public.tap_encounters where id=p_encounter and placard_id=p_placard for update;
 if not found then return 'expired'; end if;
 if e.consumed then return 'received'; end if;
 if e.expires_at<=clock_timestamp() then return 'expired'; end if;
 if p_rating is null or p_rating not between 1 and 5 or p_comment is null or length(p_comment)>2000 then return 'invalid'; end if;
 insert into public.tap_feedback(id,location_id,placard_id,rating,comment,is_test,analysis_status)
 values(e.id,loc,p_placard,p_rating,trim(p_comment),e.is_test,case when trim(p_comment)='' then 'ready' else 'pending' end);
 update public.tap_encounters set consumed=true where id=e.id;
 return 'received';
end $$;

create function public.tap_claim_analysis() returns setof public.tap_feedback
language sql set search_path = '' as $$
 update public.tap_feedback set lease=gen_random_uuid(),analysis_status='working',attempts=attempts+1,next_attempt=now()+interval '3 minutes'
 where id=(select f.id from public.tap_feedback f where f.analysis_status<>'ready' and f.attempts<6 and f.next_attempt<=now()
 order by next_attempt,id limit 1 for update skip locked) returning *
$$;

-- Save a single immutable evidence snapshot per local calendar quarter and mode.
create function public.tap_quarter(p_location uuid,p_previous boolean,p_test boolean,p_theme text default null,p_day date default null) returns uuid
language plpgsql set search_path = '' as $$
declare zone text; start_day date; end_day date; top_theme text; evidence jsonb; total int; book uuid; captured timestamptz:=now();
begin
 select pilot_timezone into strict zone from public.restaurants where id=p_location and active;
 start_day := date_trunc('quarter',coalesce(p_day,(captured at time zone zone)::date)::timestamp)::date;
 if p_previous then start_day := (start_day-interval '3 months')::date; end if;
 end_day := (start_day+interval '3 months')::date;
 select id into book from public.issue_playbooks where location_id=p_location and quarter_start=start_day and is_test=p_test and focus=coalesce(p_theme,'');
 if found then return book; end if;
 with period as materialized (
 select * from public.tap_feedback where location_id=p_location and is_test=p_test
 and created_at >= (start_day::timestamp at time zone zone) and created_at < least(captured,end_day::timestamp at time zone zone)
 ), mentions as (
 select distinct on(f.id, t->>'name') f.id,f.created_at,f.urgent,t->>'name' theme,t->>'excerpt' excerpt
 from period f cross join lateral jsonb_array_elements(f.themes) t where f.analysis_status='ready'
 ), ranked as (
 select theme from mentions where p_theme is null or theme=p_theme group by theme having count(*)>=2
 order by bool_or(urgent) desc,count(*) desc,theme limit 1
 )
 select r.theme,(select count(*) from period),jsonb_agg(jsonb_build_object('id',m.id,'excerpt',m.excerpt,'at',m.created_at) order by m.created_at,m.id)
 into top_theme,total,evidence from ranked r join mentions m using(theme) group by r.theme;
 if top_theme is null then return null; end if;
 insert into public.issue_playbooks(location_id,quarter_start,is_test,focus,theme,snapshot)
 values(p_location,start_day,p_test,coalesce(p_theme,''),top_theme,jsonb_build_object('timezone',zone,'start',start_day,'endExclusive',end_day,'captured',captured,'total',total,'evidence',evidence))
 on conflict(location_id,quarter_start,is_test,focus) do nothing;
 select id into strict book from public.issue_playbooks where location_id=p_location and quarter_start=start_day and is_test=p_test and focus=coalesce(p_theme,'');
 return book;
end $$;

-- Compare-and-swap commits the decision, its audit record and next job together.
create function public.issue_transition(p_location uuid,p_run uuid,p_revision int,p_state jsonb,p_detail jsonb,p_due timestamptz)
returns boolean language plpgsql set search_path = '' as $$
begin
 update public.issue_playbooks b set state=p_state,revision=revision+1,next_work=p_due
 where id=p_run and location_id=p_location and revision=p_revision
 and exists(select 1 from public.restaurants l where l.id=p_location and l.active);
 if not found then return false; end if;
 insert into public.issue_activity(run_id,revision,detail) values(p_run,p_revision+1,p_detail);
 return true;
end $$;

-- First location only. Account row lock makes double submission harmless.
create function public.tap_first_location(p_workspace uuid,p_name text,p_zone text,p_active boolean) returns uuid
language plpgsql set search_path = '' as $$
declare email text; loc uuid;
begin
 select a.owner_email into strict email from public.accounts a join public.business_workspaces w on w.account_id=a.id
 where w.id=p_workspace and w.status='active' for update of a;
 if length(trim(p_name)) not between 2 and 200 or not exists(select 1 from pg_timezone_names where name=p_zone) then raise exception 'Invalid location'; end if;
 select id into loc from public.restaurants where owner_email=email order by created_at limit 1;
 if found then return loc; end if;
 insert into public.restaurants(name,owner_email,workspace_id,active,pilot_timezone) values(trim(p_name),email,p_workspace,p_active,p_zone) returning id into loc;
 insert into public.restaurant_settings(restaurant_id) values(loc) on conflict do nothing;
 return loc;
end $$;

create function public.tap_period(p_location uuid,p_start date,p_end date,p_source uuid,p_rating int,p_test boolean,p_theme text,p_page int,p_entry uuid default null)
returns jsonb language sql stable set search_path = '' as $$
 with period as materialized (
 select f.*,p.placement from public.tap_feedback f join public.tap_placards p on f.placard_id=p.id
 join public.restaurants l on l.id=f.location_id where l.id=p_location and f.is_test=p_test
 and (p_start is null or f.created_at>=p_start::timestamp at time zone l.pilot_timezone)
 and (p_end is null or f.created_at<(p_end+1)::timestamp at time zone l.pilot_timezone)
 and (p_source is null or p_source=f.placard_id) and (p_rating is null or f.rating=p_rating)
 ), mentions as (
 select distinct f.id,t->>'name' theme from period f cross join lateral jsonb_array_elements(f.themes) t
 ), counts as (
 select theme,count(*) n from mentions group by theme
 ), filtered as (
 select f.* from period f where (p_entry is null or f.id=p_entry) and (p_theme is null or exists(select 1 from mentions m where m.id=f.id and m.theme=p_theme))
 ), rows as (
 select id,rating,comment,placement,created_at,urgent,themes,analysis_status,sentiment from filtered
 order by created_at desc,id limit 25 offset (greatest(0,least(p_page,100000))*25)
 )
 select jsonb_build_object('total',(select count(*) from period),'matches',(select count(*) from filtered),
 'ranked',coalesce((select jsonb_agg(to_jsonb(c) order by n desc,theme) from counts c),'[]'),
 'rows',coalesce((select jsonb_agg(to_jsonb(r) order by created_at desc,id) from rows r),'[]'))
$$;

do $$ declare t text; f regprocedure;
begin
 foreach t in array array['tap_placards','tap_encounters','tap_feedback','issue_playbooks','issue_activity'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public, anon, authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to service_role',t);
 end loop;
 for f in select p.oid::regprocedure from pg_proc p where p.pronamespace='public'::regnamespace
 and p.proname in ('tap_period','tap_first_location','tap_open','tap_submit','tap_claim_analysis','tap_quarter','issue_transition') loop
 execute format('revoke all on function %s from public, anon, authenticated',f);
 execute format('grant execute on function %s to service_role',f);
 end loop;
end $$;
revoke all on sequence public.issue_activity_id_seq from public, anon, authenticated;
grant usage,select on sequence public.issue_activity_id_seq to service_role;
commit;
