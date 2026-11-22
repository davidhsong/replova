begin;
set local lock_timeout = '5s';

-- Labels and excerpts remain in their original rows. No replay or historical rewrite.
create table public.tap_categories (
 id text primary key, label text not null unique, aliases text[] not null
);
insert into public.tap_categories values
 ('safety','Safety',array['food safety','food and drink safety','health and safety','customer-reported illness after consumption','reported illness','illness after consumption','foodborne illness']),
 ('product-quality','Product quality',array['food and drink quality','food quality','drink quality','product condition','stale product','watered-down product','stale or watered-down product']),
 ('cleanliness','Cleanliness & environment',array['cleanliness','odor','odour','dirt','hygiene','cleanliness and environment','unpleasant smell']),
 ('staff-conduct','Staff conduct',array['staff behavior','staff behaviour','service behavior','service behaviour','rude staff','employee conduct','staff attitude','staff rudeness','customer service behavior']),
 ('wait-times','Wait times',array['wait time','long waits','waiting times','queue delays']),
 ('accessibility','Accessibility',array['access barriers','accessible access']),
 ('maintenance','Equipment maintenance',array['equipment failure','equipment repair','facility maintenance']),
 ('pest-control','Pests and hygiene',array['pests','pest control','pest infestation']),
 ('communication','Communication',array['poor communication','unclear communication']),
 ('billing','Billing',array['pricing and billing','billing error','incorrect charges']),
 ('availability','Availability',array['stock availability','out of stock','appointment availability']),
 ('accuracy','Service accuracy',array['order accuracy','incorrect order','service errors']),
 ('privacy','Privacy',array['confidentiality','privacy concerns']);

create function public.tap_category_key(theme jsonb) returns text language sql stable set search_path='' as $$
 select coalesce(
  (select id from public.tap_categories where lower(trim(theme->>'name')) in (id,lower(label)) or lower(trim(theme->>'name'))=any(aliases) limit 1),
  (select id from public.tap_categories where id=theme->>'category' and id<>'other'),
  case when starts_with(lower(trim(theme->>'name')),'other:') then lower(trim(theme->>'name'))
       else 'other:' || lower(trim(theme->>'name')) end)
$$;

alter table public.issue_playbooks add column category_id text,
 add column simulation_due timestamptz,
 add column owner_context text not null default '',
 add column owner_verification jsonb,
 add column added_evidence jsonb not null default '[]',
 add constraint issue_simulation_isolated check(category_id is null or next_work is null);
create index issue_simulation_due on public.issue_playbooks(simulation_due) where simulation_due is not null;

create function public.tap_visits(p_location uuid,p_start date,p_end date,p_source uuid,p_rating int,p_test boolean)
returns table(id uuid,rating smallint,comment text,placement text,created_at timestamptz,urgent boolean,themes jsonb,analysis_status text,sentiment text,placard_id uuid)
language sql stable set search_path='' as $$
 select f.id,f.rating,f.comment,p.placement,f.created_at,f.urgent,f.themes,f.analysis_status,f.sentiment,p.id
 from public.restaurants l join public.tap_feedback f on f.location_id=l.id
 join public.tap_placards p on p.id=f.placard_id and p.location_id=l.id
 where l.id=p_location and l.active and f.is_test=p_test
 and (p_start is null or f.created_at >= p_start::timestamp at time zone l.pilot_timezone)
 and (p_end is null or f.created_at < (p_end+1)::timestamp at time zone l.pilot_timezone)
 and (p_source is null or p_source=p.id) and (p_rating is null or p_rating=f.rating)
$$;

create function public.tap_issue_period(p_location uuid,p_start date,p_end date,p_source uuid,p_rating int,p_test boolean,p_theme text,p_page int,p_entry uuid default null)
returns jsonb language sql stable set search_path='' as $$
 with visits as materialized (select * from public.tap_visits(p_location,p_start,p_end,p_source,p_rating,p_test)),
 mentions as materialized (
  select distinct v.id,v.urgent, public.tap_category_key(t) category from visits v cross join lateral jsonb_array_elements(v.themes) t
 ), counts as (
  select m.category,coalesce(c.label,'Other · '||substr(m.category,7)) theme,count(*) n,count(*) filter(where m.urgent) urgent
  from mentions m left join public.tap_categories c on c.id=m.category group by m.category,c.label
 ), selected as (select public.tap_category_key(jsonb_build_object('name',p_theme)) category),
 filtered as (select v.* from visits v where (p_entry is null or v.id=p_entry) and
 (p_theme is null or v.id in (select m.id from mentions m,selected s where m.category=s.category))),
 page_rows as (select * from filtered order by created_at desc,id limit 25 offset greatest(0,least(p_page,100000))*25)
 select jsonb_build_object('total',(select count(*) from visits),'matches',(select count(*) from filtered),
 'ranked',coalesce((select jsonb_agg(to_jsonb(c) order by n desc,theme) from counts c),'[]'),
 'rows',coalesce((select jsonb_agg(to_jsonb(r) order by created_at desc,id) from page_rows r),'[]'),
 'category',(select category from selected),
 'related',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'theme',b.theme,'quarter',b.quarter_start,'category',b.category_id) order by b.created_at desc)
 from public.issue_playbooks b,selected s where b.location_id=p_location and b.is_test=p_test and
 coalesce(b.category_id,public.tap_category_key(jsonb_build_object('name',b.theme)))=s.category),'[]'))
$$;

create function public.tap_issue_evidence(p_location uuid,p_start date,p_end date,p_source uuid,p_rating int,p_test boolean,p_category text)
returns table(id uuid,at timestamptz,evidence jsonb) language sql stable set search_path='' as $$
 select v.id,v.created_at,jsonb_build_object('id',v.id,'at',v.created_at,'rating',v.rating,'placement',v.placement,
 'placard',v.placard_id,'urgent',v.urgent,'details',d.items,'excerpt',d.items->0->>'excerpt','comment',v.comment)
 from public.tap_visits(p_location,p_start,p_end,p_source,p_rating,p_test) v
 cross join lateral (select jsonb_agg(t order by ord) items from jsonb_array_elements(v.themes) with ordinality a(t,ord)
 where public.tap_category_key(t)=p_category) d where d.items is not null
$$;

create function public.tap_create_issue(p_location uuid,p_start date,p_end date,p_source uuid,p_rating int,p_test boolean,p_category text,p_quarterly boolean default false)
returns uuid language plpgsql set search_path='' as $$
declare l public.restaurants; q date:=date_trunc('quarter',p_end)::date; focus_key text; book uuid; items jsonb;
 total int; label text; route text; action text; task uuid; scope text; local_today date; criteria jsonb;
begin
 select * into strict l from public.restaurants where id=p_location and active and workspace_id is not null;
 if p_start is null or p_end is null or p_start>p_end or p_category is null then return null; end if;
 focus_key:=case when p_quarterly then '' else 'category/'||p_category end;
 select id into book from public.issue_playbooks where location_id=p_location and quarter_start=q and is_test=p_test and focus=focus_key;
 if found then return book; end if;
 select (select jsonb_agg(e.evidence order by e.at desc,e.id) from public.tap_issue_evidence(p_location,p_start,p_end,p_source,p_rating,p_test,p_category) e),
 (select count(*) from public.tap_visits(p_location,p_start,p_end,p_source,p_rating,p_test)) into items,total;
 if items is null then return null; end if;
 select coalesce((select c.label from public.tap_categories c where c.id=p_category),'Other · '||substr(p_category,7)) into label;
 route:=case when p_category='safety' then 'safety' when p_category in ('maintenance','pest-control','cleanliness') then 'facilities' else 'internal' end;
 action:=case when route='safety' then 'Review the original customer report promptly and record your response.'
 when p_category='staff-conduct' then 'Review the reported interaction with the team and agree on a coaching action.'
 when route='facilities' then 'Compare simulated written service options.' else 'Review the supporting visits and assign a corrective action.' end;
 scope:=case p_category when 'maintenance' then 'Inspect equipment and perform routine maintenance'
 when 'pest-control' then 'Inspect the affected area and assess pest control needs' else 'Inspect and clean affected surfaces and assess odor sources' end;
 local_today:=(now() at time zone l.pilot_timezone)::date;
 criteria:=case when route='facilities' then jsonb_build_object('scope',scope,'maxCents',20000,'from',local_today+1,'until',local_today+7,'currency','USD','preference','Lowest qualifying all-in price, then earliest availability') end;
 insert into public.issue_playbooks(location_id,quarter_start,is_test,focus,theme,category_id,snapshot,state,simulation_due)
 values(l.id,q,p_test,focus_key,label,p_category,jsonb_build_object('timezone',l.pilot_timezone,'location',l.name,'start',p_start,'endExclusive',p_end+1,'source',p_source,'rating',p_rating,'captured',now(),'total',total,'evidence',items),
 jsonb_build_object('route',route,'stage',case when route='facilities' then 'discovery' else 'owner' end,'nextAction',action,'criteria',criteria),
 case when route='facilities' then now() end)
 on conflict(location_id,quarter_start,is_test,focus) do nothing returning id into book;
 if book is null then
 select id into strict book from public.issue_playbooks where location_id=p_location and quarter_start=q and is_test=p_test and focus=focus_key;
 return book;
 end if;
 -- Preview plans keep their practice action inside the test Playbook.
 if route<>'facilities' and not p_test then
 insert into public.playbook_tasks(workspace_id,title,description,priority)
 values(l.workspace_id,left(label||' · '||l.name,220),action,case when route='safety' or exists(select 1 from jsonb_array_elements(items) e where (e->>'urgent')::boolean) then 'high' else 'medium' end) returning id into task;
 update public.issue_playbooks set state=state||jsonb_build_object('task',task) where id=book;
 end if;
 insert into public.issue_activity(run_id,revision,detail) values(book,0,jsonb_build_object('status','Evidence reviewed','summary',action,'criteria',criteria,'category',p_category,'visits',jsonb_array_length(items)));
 return book;
end $$;

-- Preserve existing quarterly IDs and the recurring threshold; new runs use the same categories as the inbox.
create function public.tap_issue_quarter(p_location uuid,p_previous boolean,p_test boolean,p_day date default null)
returns uuid language plpgsql set search_path='' as $$
declare q date; book uuid; chosen text; z text;
begin
 select pilot_timezone into strict z from public.restaurants where id=p_location and active;
 q:=date_trunc('quarter',coalesce(p_day,(now() at time zone z)::date)::timestamp)::date;
 if p_previous then q:=(q-interval '3 months')::date; end if;
 select id into book from public.issue_playbooks where location_id=p_location and quarter_start=q and is_test=p_test and focus='';
 if found then return book; end if;
 select m.category into chosen from (
 select distinct v.id,v.urgent,public.tap_category_key(t) category
 from public.tap_visits(p_location,q,(q+interval '3 months')::date-1,null,null,p_test) v cross join lateral jsonb_array_elements(v.themes) t
 ) m group by m.category having count(*)>=2 order by bool_or(m.urgent) desc,count(*) desc,m.category limit 1;
 return public.tap_create_issue(p_location,q,(q+interval '3 months')::date-1,null,null,p_test,chosen,true);
end $$;

-- The follow-up starts after capture, respecting the saved placard, rating and customer/preview mode.
create function public.tap_issue_followup(p_location uuid,p_run uuid) returns jsonb language sql stable set search_path='' as $$
 with book as (select * from public.issue_playbooks where id=p_run and location_id=p_location and category_id is not null),
 visits as (select v.* from book b cross join lateral public.tap_visits(p_location,((b.snapshot->>'captured')::timestamptz at time zone (b.snapshot->>'timezone'))::date,null,(b.snapshot->>'source')::uuid,(b.snapshot->>'rating')::int,b.is_test) v
 where v.created_at>(b.snapshot->>'captured')::timestamptz),
 evidence as (select e.* from book b cross join lateral public.tap_issue_evidence(p_location,((b.snapshot->>'captured')::timestamptz at time zone (b.snapshot->>'timezone'))::date,null,(b.snapshot->>'source')::uuid,(b.snapshot->>'rating')::int,b.is_test,b.category_id) e
 where e.at>(b.snapshot->>'captured')::timestamptz),
 original_period_updates as (
 select e.* from book b cross join lateral public.tap_issue_evidence(p_location,(b.snapshot->>'start')::date,
 (b.snapshot->>'endExclusive')::date-1,(b.snapshot->>'source')::uuid,(b.snapshot->>'rating')::int,b.is_test,b.category_id) e
 where e.at<=(b.snapshot->>'captured')::timestamptz and not exists(
 select 1 from jsonb_array_elements(b.snapshot->'evidence') orig where orig->>'id'=e.id::text)),
 candidates as (select * from evidence union all select * from original_period_updates)
 select jsonb_build_object('total',(select count(*) from visits),'matches',(select count(*) from evidence),
 'pending',(select count(*) from visits where analysis_status<>'ready'), 'new',coalesce((select jsonb_agg(e.evidence order by e.at desc,e.id) from candidates e,book b where not exists(select 1 from jsonb_array_elements(b.added_evidence) old where old->>'id'=e.id::text)),'[]'),'through',now())
$$;

create function public.tap_attach_evidence(p_location uuid,p_run uuid) returns void language plpgsql set search_path='' as $$
declare b public.issue_playbooks; fresh jsonb;
begin
 select * into strict b from public.issue_playbooks where id=p_run and location_id=p_location and category_id is not null for update;
 fresh:=public.tap_issue_followup(p_location,p_run)->'new';
 update public.issue_playbooks set added_evidence=added_evidence||fresh where id=b.id;
end $$;

create function public.tap_verify_issue(p_location uuid,p_run uuid,p_note text) returns boolean language plpgsql set search_path='' as $$
declare b public.issue_playbooks; f jsonb;
begin
 select * into strict b from public.issue_playbooks where id=p_run and location_id=p_location and category_id is not null for update;
 f:=public.tap_issue_followup(p_location,p_run);
 if b.is_test or b.owner_verification is not null or length(trim(p_note)) not between 8 and 1400
 or b.created_at>now()-interval '7 days' or (b.snapshot->>'total')::int<5
 or (f->>'total')::int<5 or (f->>'pending')::int>0
 or (f->>'matches')::bigint*(b.snapshot->>'total')::bigint >= jsonb_array_length(b.snapshot->'evidence')::bigint*(f->>'total')::bigint then return false; end if;
 update public.issue_playbooks set owner_verification=jsonb_build_object('note',trim(p_note),'at',now(),'start',b.created_at,'total',f->'total','matches',f->'matches','rule','owner-reviewed-v1') where id=b.id;
 return true;
end $$;

-- Earlier application versions can still edit legacy plans during rollback.
create or replace function public.issue_transition(p_location uuid,p_run uuid,p_revision int,p_state jsonb,p_detail jsonb,p_due timestamptz)
returns boolean language plpgsql set search_path = '' as $$
begin
 update public.issue_playbooks b set state=p_state,revision=revision+1,next_work=p_due
 where id=p_run and location_id=p_location and revision=p_revision and category_id is null
 and exists(select 1 from public.restaurants l where l.id=p_location and l.active);
 if not found then return false; end if;
 insert into public.issue_activity(run_id,revision,detail) values(p_run,p_revision+1,p_detail);
 return true;
end $$;

-- A separate queue keeps new simulations invisible to old production workers, even on rollback.
create function public.tap_simulation_transition(p_location uuid,p_run uuid,p_revision int,p_state jsonb,p_detail jsonb)
returns boolean language plpgsql set search_path='' as $$
begin
 update public.issue_playbooks b set state=p_state,revision=revision+1,
 simulation_due=case when p_state->>'stage'='reconcile' then now()+interval '1 minute'
 when p_state->>'stage' not in ('completed','owner','attention') then now() end
 where id=p_run and location_id=p_location and category_id is not null and revision=p_revision and simulation_due is not null
 and exists(select 1 from public.restaurants l where l.id=p_location and l.active);
 if not found then return false; end if;
 insert into public.issue_activity(run_id,revision,detail) values(p_run,p_revision+1,p_detail);
 return true;
end $$;

alter table public.tap_categories enable row level security;
revoke all on public.tap_categories from public,anon,authenticated;
grant select on public.tap_categories to service_role;
do $$ declare f regprocedure;
begin
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in
 ('tap_category_key','tap_visits','tap_issue_period','tap_issue_evidence','tap_create_issue','tap_issue_quarter','tap_issue_followup','tap_attach_evidence','tap_simulation_transition','tap_verify_issue') loop
 execute format('revoke all on function %s from public,anon,authenticated',f);
 execute format('grant execute on function %s to service_role',f);
 end loop;
end $$;
commit;
