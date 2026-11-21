# Staging Playbook integration

`npm run test:staging:playbook` runs the persistent Business Playbook against
the explicitly guarded `replova-staging` Supabase project.

The runner requires a gitignored `.env.staging.local` with:

- `STAGING_INTEGRATION_TESTS=1`
- the exact expected staging project name and reference
- the staging Supabase URL, publishable key, and secret server key
- empty OpenAI, Resend, Stripe, Google, YouTube, analytics, and cron values

The runner refuses any other Supabase hostname or project reference. It creates
two confirmed synthetic users without sending email, authenticates them through
the real application session route, provisions separate workspaces through the
real onboarding route, exercises the compiled Playbook routes and RLS policies,
and restarts the production-mode Next.js server before reloading the stored
state. Run a staging-safe `npm run build` before starting the harness.

AI generation is a deterministic fixture passed through Replova's production
proposal normalization and the hardened `playbook_create_ai_proposals` RPC.
All proposal, evidence, approval, version, and task persistence is real. No
OpenAI request is made.

Fixtures use reserved `example.invalid` addresses and are removed in a final
cleanup pass. The runner also removes stale fixtures with the same explicit
prefix before starting.

## Browser E2E

`npm run test:staging:playbook:browser` runs the same fail-closed staging gates,
builds the application with the explicit staging environment, and drives an
installed Chrome or Edge browser through the persistent `/dashboard/playbook`
UI with `playwright-core`.

The browser runner covers dashboard navigation, roles, people, procedures,
proposal evidence and approval, separately applied changes, tasks, history,
stale writes, anonymous access, two-workspace isolation, restart persistence,
sign-out and renewed sessions, and desktop and iPhone-size layouts. It also
audits browser requests, console errors, loaded scripts, and external hosts.
OpenAI and every external side effect remain disabled; proposal generation is
the same deterministic normalized fixture used by the route-level runner.

Synthetic hosted fixtures are always removed in `finally`. Screenshots are
retained under the gitignored `tmp/staging-playbook-browser/` directory for
local review and contain synthetic data only.

## Published Tap and model acceptance

`node tests/staging/tap.hosted.mjs` tests the canonical staging HTTPS deployment.
Use `REPLOVA_STAGING_FILE` to point at the guarded staging file outside the
checkout. It creates two synthetic owners and three placards, downloads and
decodes the SVGs, drives signed-out mobile Chromium with JavaScript disabled,
and checks owner screens, database rows and tenant isolation. Its recurring
issue assertions use the rehearsal fixture's known comments.

`--prepare-handset` keeps one independent customer placard for physical-device
checks. Its downloaded SVG is in the ignored `tmp/staging-mobile/` directory.
`--fixture-preflight` verifies how the rehearsal deployment handles four novel
comments and a rating. `--prepare-analysis` additionally retains those five
visits, holds the four fixture rejections out of the ordinary retry queue, and
writes their IDs to `tmp/staging-analysis/batch.json`. The manifest contains
no sign-in or API credentials.

For a matched retest set `REPLOVA_ANALYSIS_RUN` to a fresh lowercase run name
for both preparation and verification. Its retained manifest goes in
`tmp/staging-analysis/<run>/batch.json`. Preparation refuses an existing manifest.
Run `node tests/local/pilot.local.mjs --comment-sentiment` for the deterministic
request, rating-only bypass and persistence checks. Only the hosted acceptance
run checks how the real model judges the wording.

For paid acceptance, use an isolated Preview of the dedicated staging project.
Supply that Preview with the verified staging Supabase settings, a private
scheduler bearer, `OPENAI_API_KEY`, and the intended `OPENAI_MODEL`. Leave
`OPENAI_BASE_URL` unset and provider dispatch disabled. In the Preview upload
bundle only, use `tests/staging/analysis-acceptance-route.ts` for the minute
cron route. Supply the manifest's location and four comma-separated encounter
IDs as `PILOT_ACCEPTANCE_LOCATION` and `PILOT_ACCEPTANCE_ENCOUNTERS`.
Call the authenticated Preview route with `?check=1` first and require every
preflight check to pass, including the exact requested model. Have the staging
scheduler invoke it with `?encounter=<reserved UUID>`, one manifest ID per
request. Keep the returned receipts, stop on a provider error and remove the
temporary job on every exit.
The route checks the Preview scope and official API origin, claims only those
four prepared visits once, and disables SDK retries. Its receipt includes the
requested and returned model, provider request ID, token counts and processing
time and queue wait. Require provider request IDs and nonzero usage before recording a live
pass. Run `node tests/staging/tap.hosted.mjs --verify-analysis` to check exact
excerpts, recurring counts, mixed feedback, praise and the rating-only control.
The verifier also opens Feedback as the synthetic location owner and checks the
rating, displayed sentiment and both chart drill-downs. Add `--local-owner-ui`
to check the revised label against a staging-configured build at
`http://localhost:3928`.

The disposable volume rehearsal uses the same local dependencies and ports as
`npm run test:pilot:browser`. Pass `--volume --minute-cadence` to
`node tests/local/pilot.local.mjs` for the 100,000-row burst and recovery test.
Use `--volume --stream` for two minutes of staggered arrivals.
