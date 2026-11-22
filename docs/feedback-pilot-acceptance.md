# Feedback pilot acceptance, November 21, 2026

## Deployment

The canonical staging site is [replova-staging.vercel.app](https://replova-staging.vercel.app). Supabase project `replova-staging` has reference `yhoblsunpmheyoqtdlvu`. The checkout was a working tree on `89908e50a21f1f2ede37b6cd6d761cc690b3bb4b`. Deployment IDs identify the uploaded revisions because the pilot includes uncommitted files.

| Check | Starting deployment | Final deployment |
| --- | --- | --- |
| Vercel deployment ID | `dpl_9MWLyKcyMDpy4Y2Nd8dkPNhxZifz` | `dpl_2p3ugNMhVictFsXf7UnTt6t3q7NL` |
| Tap handler SHA-256 prefix | `d1787e3e6525` | `d0a8950a6b8c` |
| Minute worker SHA-256 prefix | `27d5e006ddd6` | `3bfca740c5c5` |
| Supabase migration | 034 | 036 |

Compared the retained upload source with the checkout and inspected the live Vercel alias. The final hosted stylesheet also matched the checkout bytes. A fresh request to the published customer URL returned the new encounter-specific form action. On both deployments the staging-only Responses-compatible endpoint accepted three predefined synthetic comments. The shared OpenAI SDK selected it through `OPENAI_BASE_URL` with a fixture credential. Staging had no explicit model ID. Real provider dispatch stayed disabled.

Juniper’s original placard remained active. A read-only check found its two rehearsal comments and original two-item Playbook snapshot. Its published count was three, including the subsequent visit. All collection and volume writes for this acceptance run used separate fixtures.

## Customer and owner journeys

**Owner-verified on a physical phone.** The owner scanned Juniper Workshop · West Desk’s published **Welcome counter** QR, saw the correct location on the form, submitted feedback, and confirmed that it appeared in the owner’s inbox.

**NFC read pending.** The owner programmed the same placard’s NFC tag with the customer URL from the owner’s Tap screen. A successful read by a physical phone awaits owner confirmation.

The hosted runner downloaded and independently decoded the three customer SVGs with jsQR. Each decoded URL opened the correct business and location in a fresh signed-out Chromium context. The small phone viewports measured 320 × 568 and 360 × 640 CSS pixels. Chromium emulated touch, disabled JavaScript, and applied 150 ms latency with 95,000 bytes/s down and 32,000 bytes/s up. The text-size check enlarged the stylesheet to a 32 px body. Montserrat loaded, the page fit horizontally, and all five rating targets measured at least 44 × 44 CSS pixels. Native required-field validation, server validation, an optional comment, keyboard text entry, Tab focus and touch submission worked. The owner’s physical check establishes the QR-to-inbox journey. Browser-specific behavior and on-screen keyboard coverage remain open on physical devices.

The runner exercised two successive touch events, simultaneous copies of a POST, a connection reset after commit, expiry and starting a fresh form. Native Chromium reload resubmitted the lost POST and displayed the receipt. Replaying the same encounter left one feedback row. The submitted URL also supports GET recovery. A blocked POST produced neither a visible receipt nor a persisted visit. A separate disposable PostgreSQL test held the encounter row lock until the submitting transaction was waiting, then released it and verified the single write and receipt.

| Workspace and location | Time zone | Published visits | Wait times | Saved evidence |
| --- | --- | ---: | ---: | ---: |
| A, Cedar desk | America/Los_Angeles | 3 | 2 | 2 |
| A, Elm desk | Asia/Tokyo | 4 | 3 | 3 |
| B, Birch desk | America/New_York | 5 | 2 | 2 |

All three placards used the placement name **Welcome counter**. The inbox, chart, supporting row IDs, comments and saved Playbook agreed at each location. Preview visits stayed outside the denominators. In a follow-up hosted run, A signed in using two independent browser sessions and selected Cedar in one and Elm in the other. After a concurrent refresh, each session retained its own selection, time zone and exact set of published inbox rows. Bookmarked feedback and Playbooks prompted an explicit switch back to the owning location. B received a denial for A’s bookmarked URLs, active-location API request and direct private-table reads. Revoking Elm’s placard stopped both a previously opened form and new visits there. The two other placards remained available during that check.

Date filters included local midnight and excluded the preceding second in Los Angeles and Tokyo. Controlled disposable records on either side of Los Angeles midnight on April 1 produced separate quarterly snapshots with two supporting visits each. On November 21 at 1:20 a.m. Pacific, Supabase Cron invoked the hosted daily worker. Its recorded run succeeded, removed the two-day-expired test encounter, and retained the unexpired control. The minute worker continued on its separate schedule.

## Analysis acceptance

**Live integration passed. Sentiment acceptance failed on two of four comments.** Supabase Cron invoked isolated staging Preview `dpl_5hqYc6QV6cCtmdkCmaA5GQfpgJXt` for the existing manifest. Runtime preflight verified Preview scope, the staging database, the official OpenAI API origin, the requested model, disabled provider dispatch and the four-ID limit. The scheduler claimed the four reserved comments sequentially with SDK retries disabled. All four calls returned `gpt-6-luna` and saved results. The fifth visit contained only a rating and had zero analysis attempts.

| Reserved visit | Provider request ID | Input / output tokens | Model-call duration | Visit to start of processing |
| --- | --- | ---: | ---: | ---: |
| Queue phrasing 1 | `req_e4396a71454c4c51b4500c829a1e1f14` | 164 / 75 | 2.832 s | 26 min 24.425 s |
| Queue phrasing 2 | `req_ed1969990ec948edae9e71c2edde14b6` | 166 / 74 | 1.612 s | 26 min 32.611 s |
| Mixed visit | `req_7b8002a15b8b4c1983473daa3202736c` | 168 / 92 | 1.647 s | 26 min 41.271 s |
| Praise only | `req_988198b0230342dbb1233fa2802cf077` | 165 / 87 | 1.540 s | 26 min 49.406 s |

The last column includes the deliberate hold for credentials and scheduled dispatch. The owner's hosted Feedback screen displayed **Wait times · 2 of 5 submissions** and **Accessibility · 1 of 5 submissions**. Opening each chart bar showed the expected visit IDs. All three supporting excerpts occurred verbatim in their source comments. Praise generated zero complaint themes.

`node tests/staging/tap.hosted.mjs --verify-analysis` stopped at the mixed visit, labeled **negative** instead of **mixed**. An independent read found that the praise-only visit was labeled **mixed** instead of **positive**. All four comment submissions in the preparation harness had a 2/5 rating, including the praise-only visit. The prompt specifies how to extract operational issues but leaves the relationship between rating and comment sentiment undefined. That ambiguity is a candidate explanation.

A disposable local replay sent the same four ratings and comments through the shared classifier, worker and PostgreSQL using two deterministic model responses per input. The captured labels persisted as negative, negative, negative and mixed. Changing only the last two fixture labels to mixed and positive produced the expected saved labels while preserving theme evidence. This isolates the discrepancy to model classification. Rollout still needs an explicit comment-sentiment rubric and live evidence that mixed and praise-only cases meet it.

The temporary schedule, scheduler credentials and temporary Preview settings were removed. The canonical alias retained its existing deployment and continues to send ordinary customer comments to the deterministic fixture. Juniper and Coral retain their published placards. The run issued no provider bookings or further paid batches. See the [staging test instructions](../tests/staging/README.md).

### Matched live sentiment retest

**Pass for a controlled, feedback-only pilot at one location.** The original run scored 2/4 on comment sentiment. With the revised classifier, all four labels matched the wording. The four comment texts and 2/5 ratings were identical across runs, as was the rating-only control. Independent staging reads confirmed separate workspaces and locations, ten distinct encounters, and five visits in each denominator. Both placards remained active. The original labels and receipts were retained.

The shared classifier now sends only the written comment to the Responses API. It defines positive as praise or satisfaction, negative as criticism or dissatisfaction, mixed as substantive expressions of both, and neutral as neither. Courtesy alone does not count as praise. Separate instructions cover complaint extraction with exact supporting text and urgency requiring prompt intervention. The strict schema, verbatim evidence check, and direct persistence of the returned label still apply. Feedback shows the original numeric rating and labels the text assessment **Comment sentiment** for eligible plans. An empty comment has no text sentiment. This comparison changed both the rubric and the input, so it cannot establish the rating’s contribution to the original errors.

| Visit | Expected from wording | Original | Retest | Persisted complaints |
| --- | --- | --- | --- | --- |
| Wait complaint 1 | Negative | Negative | Negative | Wait times |
| Wait complaint 2 | Negative | Negative | Negative | Wait times |
| Praise and an access barrier | Mixed | Negative | Mixed | Accessibility |
| Praise only | Positive | Mixed | Positive | None |
| Rating only | No text sentiment | None | None | None |

Supabase Cron invoked isolated Preview `dpl_6m8Kuaz83evi4m2KmTjtcWWmodQx` for the four new encounter IDs at one location. Authenticated runtime preflight passed for Preview scope, the verified staging database, API key presence, the official OpenAI origin, the exact model, disabled provider dispatch, and the location and encounter limits. Each comment had one paid request, SDK retries were disabled, and all four responses persisted. The rating-only control had zero analysis attempts. The ordinary queue was outside the paid worker’s claim scope.

| Visit | Provider request ID | Input / output tokens | Model call | Schedule armed to dispatch | Visit to processing start |
| --- | --- | ---: | ---: | ---: | ---: |
| Wait 1 | `req_a98601bd59254faa828ba7f59903ad10` | 321 / 36 | 1.228 s | 10.156 s | 220.135 s |
| Wait 2 | `req_461bc1fe50e44806a054cd4cbe217094` | 323 / 36 | 0.758 s | 20.171 s | 228.320 s |
| Mixed | `req_d8b1cd44ab434852a001a9be7e1b0100` | 325 / 37 | 0.914 s | 30.186 s | 236.837 s |
| Praise | `req_a354ec2ad17e4c2197c67b5b820e8421` | 322 / 21 | 0.913 s | 40.211 s | 244.662 s |

Every request specified and returned `gpt-6-luna`. Model-call time measures the Responses call. The scheduler column measures elapsed database time from arming the temporary job to the start of each invocation. Visit-to-processing time also includes the fixture preflight and the hold while preparing the Preview. The job was removed, the temporary hosting bypass revoked, and the temporary scheduler secrets and six Preview settings removed. The separately supplied model and key settings were retained.

The hosted verifier signed in as the new location’s owner and found all five persisted visits and their ratings. **Wait times · 2 of 5 submissions** opened exactly the two wait visits. **Accessibility · 1 of 5 submissions** opened only the mixed visit, which was marked nonurgent. All three supporting excerpts occurred verbatim in their source comments. Praise had no complaint, and the rating-only row had no sentiment or theme. The same owner checks passed on a 360 px viewport against the revised local production build backed by staging, including the explicit **Comment sentiment** label. Canonical staging retained its existing deployment and fixture for ordinary customer comments.

The focused disposable integration test exercised the actual worker, Responses request and PostgreSQL writes with deterministic fixture responses for praise, criticism, mixed feedback, neutral factual text and a courteous complaint. Each pair of 2/5 and 5/5 visits produced identical request bodies. Both ratings, the supplied labels and the exact excerpts persisted. Two rating-only visits had zero calls. The four hosted receipts above provide the real-model judgment check. All 194 `npm test` tests passed. `npm run verify` passed lint, type checking and the staging-configured Next.js build with one existing location-switcher navigation warning.

Before enabling the first production location, enforce location-scoped paid claims or use a dedicated pilot database, since the ordinary worker claims across eligible locations. Verify the target’s migrations through 036, deploy the tested revision, configure the public HTTPS origin and the authorized model credentials, and enable authenticated schedules for that scope. Keep provider dispatch disabled. Check the first QR submission through receipt and owner Feedback, and monitor model errors, queue age, usage and sampled labels. The Juniper physical QR-to-inbox check remains owner-verified and the physical NFC read awaits confirmation.

## Measurement method

The local harness started disposable PostgreSQL 18.7 with PostgREST 16.6, Next.js 16.4.6 in development mode and a loopback HTTP Responses fixture on Windows. The host had an AMD Ryzen 3 PRO 4350G with eight logical processors and also ran other checks. Each run seeded 100,000 ready historical rows over 89 days, 20 businesses and 60 locations. After warming the form and worker routes, four concurrent clients submitted 40 hot-location and four quiet-location comments through the HTTP form endpoints. Eleven repeat POSTs reused existing encounter IDs. The deterministic model took 100 ms per call and failed four first attempts. The clocked comparison used real 60-second ticks and normal retry backoff.

Collection latencies cover full local HTTP responses. Query timings cover the complete database RPC with 20 warm samples each, alternating between two pages. The separate query-plan run measured a 30-day filter. Clocked queue measurements include database, worker, fixture and HTTP overhead. They exclude paid-model latency and hosted network capacity. A two-minute steady-arrival run separately injected 24 hot and two quiet visits per minute. Real provider booking and gateway acceptance were deferred.

| Clocked burst measurement | Original worker and 034 | Final worker and 036 |
| --- | ---: | ---: |
| Open form p50 / p95 | 58.6 / 329.4 ms | 99.1 / 190.3 ms |
| Submit form p50 / p95 | 57.9 / 137.4 ms | 92.6 / 132.5 ms |
| Inbox with chart p50 / p95 | 8.3 / 9.7 ms | 10.0 / 11.8 ms |
| Theme-filtered inbox with chart p50 / p95 | 9.6 / 11.1 ms | 9.6 / 12.2 ms |
| Committed out of 44 distinct encounters | 44 | 44 |
| Lost / duplicate feedback records | 0 / 0 | 0 / 0 |
| Completed on first invocation, including injected failures | 3 | 21 |
| First quiet result observed after the first tick began | 600.5 s, tick 11 | 1.84 s, tick 1 |
| Largest age of an unclaimed job observed immediately after a tick | 540.9 s | 3.6 s |
| Largest age of unfinished work, including retry backoff | 780.5 s | 241.0 s |
| Invocation when all 44 were ready | 14 | 5 |

In the staggered test the final worker completed 24, 24 and four jobs on successive one-minute invocations. All four quiet visits were ready by the second tick. The largest observed quiet visit-to-ready time was 54.7 seconds. Four jobs remained when the 52 arrivals ended and cleared on the following tick. This establishes a tested rate of 24 completed jobs per minute for this fixture and workload.

A fresh disposable run after the owner’s phone check reproduced all three completion counts. All 52 visits finished, with a maximum observed quiet-location delay of 55.1 seconds.

PostgreSQL used the existing location/date index for the inbox and theme selection, the encounter-expiry index for cleanup, and the partial next-attempt index for eligible jobs. On the final 44-job backlog, choosing the next location took 0.110 ms and choosing its row took 0.081 ms. Planning the complete installed 30-day RPC body with `EXPLAIN (ANALYZE, BUFFERS)` gave execution times of 2.874 ms for the inbox and 4.843 ms with a theme filter. The JSON theme aggregation and top-25 sort operated on the selected location and date range. The plans supported retaining the existing indexes. The first two 25-row pages contained 50 distinct IDs. An abandoned claim became eligible after its lease expired and completed on the next invocation.

## Verification

All 194 tests passed. `npm run verify` passed lint, type checking and the staging-configured build. The local pilot browser suite, both guarded staging Playbook suites and the final published Tap browser suite passed. The durable handset test placard is separate from Juniper and from the five-visit model batch. [Open the Coral desk customer form](https://replova-staging.vercel.app/t/25d0dbcc-aa91-4663-b4a7-74bac209edb0).
