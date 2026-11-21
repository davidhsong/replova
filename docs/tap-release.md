# One-location feedback pilot

The acceptance baseline is commit `0ea5b584e63b54ad3d13c6b2e51fcbebb60f702d`. Its classifier matched the retained passing Preview upload byte for byte (SHA-256 `d15cf7e29a93ee04700264cd7adaa3157773075246d8affe87fefe068f14693bb`). Migration 037 and the ordinary worker add eligibility and receipt metadata around that classifier. The four-ID route in tests/staging is a historical test adapter. Always deploy the app's ordinary route.

## Launch on replova.app

1. Obtain the owner's approval for one business and physical location, a production release window, and a paid analysis allowance. Confirm the authorized operator has access to the production Vercel project, Supabase database, OpenAI project and scheduler. Verify the production domain and database project reference in both consoles. Inventory existing Tap schedules, workers, and leases.
2. In the production database, look up the workspace and location, cross-check both UUIDs with the owner and verify its IANA time zone. Confirm the active location on the owner's Tap screen. Duplicate names and the placard label are insufficient. Retain the two UUIDs in the private change record.

   ```sql
   select w.id as workspace_id, w.name as workspace, l.id as location_id,
          l.name as location, l.pilot_timezone, l.active
   from public.restaurants l join public.business_workspaces w on w.id=l.workspace_id
   where w.id = :workspace_id and l.id = :location_id;
   ```

3. Pause existing Tap minute triggers and let older in-flight workers finish (the minute route has a 120-second maximum). Inspect working leases before continuing. Verify migration history, review the dry run and apply pending migrations in order through 037. The new table starts empty. The legacy claim RPC returns zero even after activation. Before migration the new worker lacks its RPC and fails closed. Keep 037 in place if rolling the app back.
4. Deploy the approved release to the verified production project with the production Supabase URL, anonymous key and server-only service key. Set `NEXT_PUBLIC_BASE_URL=https://replova.app`, server-side `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-6-luna`, and a private `CRON_SECRET`. Use the default official Responses API origin. Keep `PILOT_PROVIDER_LIVE=false` and provider gateway credentials unset. Confirm separate email, booking and other services retain their existing authorized configuration.
5. Register exactly one authenticated minute invocation of `/api/cron/pilot` and one authorized daily `/api/cron/pilot-quarter` job using the configured deployment scheduler. Avoid duplicate Vercel and database schedules. With the eligibility table empty, call the authenticated minute route with `?check=1` and verify the production environment, database origin, explicit model, official endpoint and disabled provider dispatch. Confirm the scope is empty. The preflight makes zero model requests.
6. Activate only the approved UUID with the database operator role. Supply the confirmed positive integer claim allowance. Inspect the returned UUID, cutoff and budget. A duplicate activation raises an error. An omitted allowance allows uncapped claims and requires a separate explicit decision. The balance debits at lease acquisition, including abandoned claims. SDK retries are disabled.

   ```sql
   insert into public.tap_analysis_locations(location_id, remaining_claims)
   select id, :approved_claims from public.restaurants
   where id=:location_id and workspace_id=:workspace_id and active
   returning location_id, enabled_from, remaining_claims;
   ```

7. On **replova.app → Dashboard → location selector → Tap**, confirm the site and time zone, issue the Welcome counter placard, and download its printable QR. Decode it and verify the exact HTTPS production origin and placard path against the customer URL on that screen. Only then print the production QR and write that exact URL to the NFC tag. Physically scan and tap before installing the placard. Keep the staging placards separate.
8. Follow the published QR signed out on a phone. Submit the first authorized written visit, observe the receipt, then open **Dashboard → same location → Feedback**. Check the rating, text sentiment, theme evidence where applicable, denominator and scheduled receipt. Check a rating-only visit counts with zero attempts. Monitor attempts, budget, error rate and queue age during the pilot. Pause for unexpected charges, routing or quality problems.

## Pause, inspect and recover

Pause by deleting the location's eligibility row using the database operator role. Collection, customer receipts and inbox totals continue. The worker rechecks the active window and lease immediately before calling the SDK. An invocation already past that check is in flight and can finish, incur cost and persist its result. Pausing cannot cancel a request already authorized. After reactivation only feedback collected at or after the **new** database timestamp is eligible. Existing historical or paused comments stay saved. This includes unfinished retries and expired leases from the previous window. Customer submissions, owner retries, creating a placard and switching locations never grant eligibility.

```sql
delete from public.tap_analysis_locations where location_id=:location_id returning location_id;
```

Inspect jobs without reading customer text. Times and budgets are server-side. A completed rating-only visit has zero attempts, null sentiment and no receipt. An enabled site's owner can retry a failed job in the current window through Feedback. The RPC checks location, cutoff, active status and available balance again. Existing leases recover after three minutes. Ordinary errors back off exponentially up to six claims per visit. A receipt records the returned model, request ID, tokens and model-call time on successful persistence.

```sql
select f.id, f.created_at, f.analysis_status, f.attempts, f.next_attempt,
       a.enabled_from, a.remaining_claims, f.analysis_receipt->>'requestId' as request_id
from public.tap_feedback f left join public.tap_analysis_locations a on a.location_id=f.location_id
where f.location_id=:location_id order by f.created_at desc limit 50;
```

For an exhausted budget, explicitly authorize and add a finite number of claims to the existing activation row to resume eligible pending jobs. A worker that reserved the final claim can still finish. For an exhausted failed visit use the owner's Retry analysis action after restoring budget. Do not backdate the cutoff, edit submission timestamps, or reset a whole backlog. Analysis of pre-activation history requires a separately reviewed bounded backfill for specifically authorized submissions.

## Repeat the checks

Run `npm test`, `npm run verify`, and the disposable pilot harness with `--scoped-analysis`, `--volume --excluded-backlog`, and `--comment-sentiment`. Run `npm run test:pilot:browser` for the existing owner and customer flow. See [local setup](pilot.md). For staging use a clean export of the release in an isolated Preview, point the authenticated staging minute schedule at its ordinary route, and follow the hosted driver in [scoped.hosted.mjs](../tests/staging/scoped.hosted.mjs). Set a two-claim database budget on an empty fresh synthetic location only. Verify runtime preflight before activation and remove the job and eligibility row in a finally block. An earlier deterministic staging deployment serving the legacy RPC will collect visits but cannot analyze new comments after 037.
