begin;

-- The task editor includes status when saving other fields. Keep the recorded
-- completion through a repeated 'done' save; reopening and completing starts a new event.
create function public.tap_keep_task_completion() returns trigger
language plpgsql set search_path='' as $$
begin
 if exists (select 1 from public.issue_playbooks b join public.restaurants l on l.id=b.location_id
            where l.workspace_id=old.workspace_id and b.category_id is not null and b.state->>'task'=old.id::text) then
   new.completed_at := old.completed_at;
 end if;
 return new;
end $$;
revoke all on function public.tap_keep_task_completion() from public,anon,authenticated;
create trigger tap_keep_task_completion before update of completed_at on public.playbook_tasks
for each row when (old.status='done' and new.status='done' and old.completed_at is not null
                   and new.completed_at is distinct from old.completed_at)
execute function public.tap_keep_task_completion();

-- Evaluate on the owner read. This function cannot enqueue work or change a Playbook.
create function public.tap_feedback_trend(p_location uuid, p_run uuid)
returns jsonb language sql stable set search_path='' as $$
 with book as (
   select b.*, l.workspace_id,
     coalesce(b.category_id, public.tap_category_key(jsonb_build_object('name',b.theme))) as category,
     (b.snapshot->>'start')::date::timestamp at time zone (b.snapshot->>'timezone') as baseline_start,
     least((b.snapshot->>'endExclusive')::date::timestamp at time zone (b.snapshot->>'timezone'),
           (b.snapshot->>'captured')::timestamptz,b.created_at) as baseline_end,
     statement_timestamp() as evaluated
   from public.issue_playbooks b join public.restaurants l on l.id=b.location_id
   where b.id=p_run and b.location_id=p_location and l.active
 ), actions as (
   select b.*, case when not b.is_test then
     case when b.category_id is not null and b.state->>'route' in ('internal','safety') then
       (select t.completed_at from public.playbook_tasks t
        where t.workspace_id=b.workspace_id and t.id=(b.state->>'task')::uuid and t.status='done')
     when b.category_id is null then
       (select a.created_at from public.issue_activity a where a.run_id=b.id and a.detail->>'action'='task'
        order by a.revision desc limit 1)
     end end as completion
   from book b
 ), windows as (
   select a.*,case when completion between created_at and evaluated then completion end as completed_at,
     case when completion between created_at and evaluated then completion else created_at end as follow_start
   from actions a
 ), counts as (
   select w.*,
     case when w.category_id is null then historical.matches else jsonb_array_length(w.snapshot->'evidence') end as baseline_matches,
     case when w.category_id is null then historical.total else (w.snapshot->>'total')::int end as baseline_total,
     later.matches, later.total, later.pending
   from windows w
   -- An older saved plan used free-text themes. Compare its broad category in both windows.
   cross join lateral (
     select count(*) as total, count(*) filter(where exists (
       select 1 from jsonb_array_elements(v.themes) t where public.tap_category_key(t)=w.category
     )) as matches
     from public.tap_visits(p_location,null,null,(w.snapshot->>'source')::uuid,(w.snapshot->>'rating')::int,w.is_test) v
     where w.category_id is null and v.created_at>=w.baseline_start and v.created_at<w.baseline_end
   ) historical
   cross join lateral (
     select count(*) as total, count(*) filter(where v.analysis_status<>'ready') as pending,
       count(*) filter(where exists (
         select 1 from jsonb_array_elements(v.themes) t where public.tap_category_key(t)=w.category
       )) as matches
     from public.tap_visits(p_location,null,null,(w.snapshot->>'source')::uuid,(w.snapshot->>'rating')::int,w.is_test) v
     where v.created_at>=w.follow_start and v.created_at>w.created_at and v.created_at<=w.evaluated
   ) later
 )
 select jsonb_build_object(
   'baselineStart',baseline_start,'baselineEnd',baseline_end,'baselineMatches',baseline_matches,'baselineTotal',baseline_total,
   'completedAt',completed_at,'start',follow_start,'evaluated',evaluated,'matches',matches,'total',total,'pending',pending,
   'status',case when is_test or evaluated-follow_start < interval '168 hours' or baseline_total<5 or total<5 or pending>0 then 'waiting'
                 when matches::numeric*baseline_total < baseline_matches::numeric*total then 'less' else 'no_decrease' end)
 from counts
$$;
revoke all on function public.tap_feedback_trend(uuid,uuid) from public,anon,authenticated;
grant execute on function public.tap_feedback_trend(uuid,uuid) to service_role;

-- Optional explicit owner confirmation uses the same comparison the owner sees.
create or replace function public.tap_verify_issue(p_location uuid,p_run uuid,p_note text)
returns boolean language plpgsql set search_path='' as $$
declare b public.issue_playbooks; trend jsonb;
begin
 select * into strict b from public.issue_playbooks where id=p_run and location_id=p_location and category_id is not null for update;
 if b.owner_verification is not null or length(coalesce(p_note,''))>1400 then return false; end if;
 trend:=public.tap_feedback_trend(p_location,p_run);
 if trend->>'status' is distinct from 'less' then return false; end if;
 update public.issue_playbooks set owner_verification=jsonb_build_object(
 'note',trim(coalesce(p_note,'')),'at',trend->'evaluated','start',trend->'start','total',trend->'total',
 'matches',trend->'matches','rule','owner-reviewed-v2','comparison',trend) where id=b.id;
 return true;
end $$;
commit;
