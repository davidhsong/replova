begin;
-- One snapshot for the graph, ranked categories and paginated inbox.
create function public.tap_flow_period(p_location uuid,p_start date,p_end date,p_source uuid,p_rating int,p_test boolean,p_theme text,p_page int,p_entry uuid,p_flow text)
returns jsonb language sql stable set search_path='' as $$
 with visits as materialized (select * from public.tap_visits(p_location,p_start,p_end,p_source,p_rating,p_test)),
 mentions as materialized (
  select distinct v.id,v.urgent, public.tap_category_key(t) category from visits v cross join lateral jsonb_array_elements(v.themes) t
 ), counts as (
  select m.category,coalesce(c.label,'Other · '||substr(m.category,7)) theme,count(*) n,count(*) filter(where m.urgent) urgent
  from mentions m left join public.tap_categories c on c.id=m.category group by m.category,c.label
 ), selected as (select public.tap_category_key(jsonb_build_object('name',p_theme)) category),
 scoped as (select v.*, case
   when nullif(trim(v.comment),'') is null then 'rating'
   when v.analysis_status='working' then 'pending'
   when v.analysis_status='failed' then 'unavailable'
   when v.analysis_status<>'ready' then case when exists(select 1 from public.tap_analysis_locations a where a.location_id=p_location and v.created_at>=a.enabled_from and a.remaining_claims is distinct from 0) then 'pending' else 'unavailable' end
   when v.urgent then 'urgent'
   when jsonb_array_length(v.themes)>0 then 'other'
   else 'clear' end as leaf from visits v where (p_entry is null or v.id=p_entry) and
 (p_theme is null or v.id in (select m.id from mentions m,selected s where m.category=s.category))),
 leaves as (select leaf,count(*) n from scoped group by leaf),
 filtered as (select * from scoped where p_flow is null or p_flow='total' or leaf=p_flow or (p_flow='written' and leaf<>'rating') or (p_flow='issue' and leaf in ('urgent','other'))),
 page_rows as (select * from filtered order by created_at desc,id limit 25 offset greatest(0,least(p_page,100000))*25)
 select jsonb_build_object('total',(select count(*) from visits),'matches',(select count(*) from filtered),
 'leaves',coalesce((select jsonb_object_agg(leaf,n) from leaves),'{}'),
 'ranked',coalesce((select jsonb_agg(to_jsonb(c) order by n desc,theme) from counts c),'[]'),
 'rows',coalesce((select jsonb_agg(to_jsonb(r) order by created_at desc,id) from page_rows r),'[]'),
 'category',(select category from selected),
 'related',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'theme',b.theme,'quarter',b.quarter_start,'category',b.category_id) order by b.created_at desc)
 from public.issue_playbooks b,selected s where b.location_id=p_location and b.is_test=p_test and
 coalesce(b.category_id,public.tap_category_key(jsonb_build_object('name',b.theme)))=s.category),'[]'))
$$;

revoke all on function public.tap_flow_period(uuid,date,date,uuid,int,boolean,text,int,uuid,text) from public,anon,authenticated;
grant execute on function public.tap_flow_period(uuid,date,date,uuid,int,boolean,text,int,uuid,text) to service_role;
commit;
