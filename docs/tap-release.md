# One-location feedback pilot

The acceptance baseline is commit `0ea5b584e63b54ad3d13c6b2e51fcbebb60f702d`. Its classifier matched the retained passing Preview upload byte for byte (SHA-256 `d15cf7e29a93ee04700264cd7adaa3157773075246d8affe87fefe068f14693bb`). Migration 037 and the ordinary worker add eligibility and receipt metadata around that classifier. The four-ID route in tests/staging is a historical test adapter. Always deploy the app's ordinary route.

## Launch on replova.app

**Release candidate** `bd5bec3834924aa220478e51a04d422a006827e1`, local branch `release/tap-scoped-analysis`. The staged application was exported with `git archive` from this commit. Vercel Preview `dpl_6akavHJkXhpcKSGnPyQwbVXk6f3R` used the ordinary route from the archive. The production application, database and schedulers were untouched.

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

For the production schedule in step 5, use Supabase Cron with pg_net and Vault. Store the worker's production bearer as a Vault secret named `replova_pilot_cron` using the private project settings. After checking that the URLs and job names have no existing triggers, the database operator can register the following jobs. Supabase Cron interprets these schedules in UTC. Check both Cron history and the HTTP response because pg_net queues the HTTP request asynchronously.

```sql
select cron.schedule('replova-pilot-minute','* * * * *',$job$
  select net.http_get(url := 'https://replova.app/api/cron/pilot',
    headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name='replova_pilot_cron')),
    timeout_milliseconds := 55000);
$job$);
select cron.schedule('replova-pilot-quarter','20 9 * * *',$job$
  select net.http_get(url := 'https://replova.app/api/cron/pilot-quarter',
    headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name='replova_pilot_cron')),
    timeout_milliseconds := 55000);
$job$);
```

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

After the hosted check, independent reads verified zero enabled staging locations and the absence of the temporary job and Vault secrets. The temporary hosting bypass and Preview settings were removed. The original model settings remained present. The canonical staging alias still serves its earlier deployment. Juniper's prior physical phone QR-to-inbox confirmation stands. The physical NFC read still awaits the owner's confirmation.

On November 21, 2026, the scheduler in Supabase project `yhoblsunpmheyoqtdlvu` successfully invoked that Preview at 02:12 Pacific. The HTTP worker processed one paid claim. The owner-issued Welcome counter QR decoded to the protected Preview. A signed-out mobile Chromium context with JavaScript disabled submitted two visits. The written visit received its receipt in 313 ms. The rating-only control received its receipt in 346 ms. The owner saw the saved analysis on the location's Feedback screen 23.817 seconds after submitting the written visit, including the scheduler wait and browser observation interval. The Responses call took 1.784 seconds. It requested and returned `gpt-6-luna` with 321 input and 21 output tokens. The inbox showed two submissions, the written 2/5 rating with positive comment sentiment and zero complaints, and the 5/5 rating-only row with zero attempts. The raw receipt is retained privately. An independent digest of all other locations' claim counts, leases, analysis status and receipt metadata matched before and after. Both original synthetic batches still contained five ready visits. Juniper and Coral placards were still active.

The deterministic scoped browser and PostgreSQL test passed with two businesses, three identically labeled placards and only A1 enabled. It covered concurrent workers, failed-call retry, lease expiry, deactivation between claim and dispatch, reactivation with a fresh cutoff, empty scope, owner switching, and customer/owner role restrictions. With 20 businesses, 60 locations and 100,000 historical visits, an EXPLAIN ANALYZE of the entire claim RPC took 63.546 ms with the existing indexes and 98,333 older excluded due jobs. With the additional location/due index, a fresh run took 4.236 ms with 98,334 excluded jobs. The ordinary worker finished the enabled comment on its first tick (452 ms including the HTTP worker, fixture, and verification read). These are individual disposable measurements. The prior location/date and due-time indexes remain. The sentiment fixtures, existing pilot browser run, all 194 unit/integration tests, and lint/typecheck/build verification passed. Lint reported the existing location-switcher navigation warning.

Run `npm test`, `npm run verify`, and the disposable pilot harness with `--scoped-analysis`, `--volume --excluded-backlog`, and `--comment-sentiment`. Run `npm run test:pilot:browser` for the existing owner and customer flow. See [local setup](pilot.md). For staging use a clean export of the release in an isolated Preview, point the authenticated staging minute schedule at its ordinary route, and follow the hosted driver in [scoped.hosted.mjs](../tests/staging/scoped.hosted.mjs). Set a two-claim database budget on an empty fresh synthetic location only. Verify runtime preflight before activation and remove the job and eligibility row in a finally block. An earlier deterministic staging deployment serving the legacy RPC will collect visits but cannot analyze new comments after 037.
