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
