-- Synthetic read-only review workspace. Run once, on an empty fixture DB or replova-staging.
begin;
insert into auth.users(id,email,email_confirmed_at) values
('7170de00-69ce-4280-854c-ba19c7325001','flow-review@example.invalid',now());
select * from public.provision_replova_account_workspace('7170de00-69ce-4280-854c-ba19c7325001','flow-review@example.invalid','Flow review','growth');
insert into public.restaurants(id,name,owner_email,workspace_id,pilot_timezone,active)
select '7170de00-69ce-4280-854c-ba19c7325401','Cedar Studio',a.owner_email,w.id,'America/Los_Angeles',true
from public.business_workspaces w join public.accounts a on a.id=w.account_id where a.owner_email='flow-review@example.invalid';
insert into public.tap_placards(id,location_id,placement) values
('7170de00-69ce-4280-854c-ba19c7325501','7170de00-69ce-4280-854c-ba19c7325401','Welcome counter');
with sample(n,comment,urgent,rating,labels) as (values
 (1,'The drink tasted stale. I felt ill afterward.',true,1,array['Food safety','Product quality']),
 (2,'I felt sick after my order.',true,2,array['Food and drink safety']),
 (3,'There was an odor and dirt near the entrance.',false,2,array['Odor','Cleanliness']),
 (4,'Dust on the counter.',false,3,array['Cleanliness']),
 (5,'The drink was watered down.',false,2,array['Product quality']),
 (6,'The employee was rude.',false,2,array['Staff conduct']),
 (7,'',false,4,array[]::text[]),
 (8,'Wonderful service.',false,5,array[]::text[]),
 (9,'Easy pickup and a friendly welcome.',false,5,array[]::text[]))
insert into public.tap_feedback(id,location_id,placard_id,rating,comment,urgent,themes,analysis_status,is_test,created_at)
select ('7170de00-69ce-4280-854c-ba19c732560'||n)::uuid,'7170de00-69ce-4280-854c-ba19c7325401',
'7170de00-69ce-4280-854c-ba19c7325501',rating,comment,urgent,
coalesce((select jsonb_agg(jsonb_build_object('name',label,'excerpt',comment)) from unnest(labels) label),'[]'),
'ready',false,'2026-11-12 18:00Z'::timestamptz + n*interval '1 hour' from sample;
commit;
