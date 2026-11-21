begin;
-- A reload of the submitted form may arrive as GET after a mobile connection drops.
-- Only the placard label, test flag and receipt state can leave this function.
create function public.tap_resume(p_placard uuid,p_encounter uuid)
returns table(business text,is_test boolean,status text) language sql stable set search_path='' as $$
 select public.tap_label(p.id),coalesce(f.is_test,e.is_test,false),
   case when f.id is not null then 'received'
        when e.expires_at>now() then 'open' else 'expired' end
 from public.tap_placards p join public.restaurants l on l.id=p.location_id
 left join public.tap_feedback f on f.id=p_encounter and f.placard_id=p.id
 left join public.tap_encounters e on e.id=p_encounter and e.placard_id=p.id
 where p.id=p_placard and p.revoked_at is null and l.active
$$;
revoke all on function public.tap_resume(uuid,uuid) from public,anon,authenticated;
grant execute on function public.tap_resume(uuid,uuid) to service_role;
commit;
