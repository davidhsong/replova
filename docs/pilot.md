# Replova pilot

## First location

Apply Supabase migrations through `036_tap_resume.sql` in order in staging. Use the app’s existing Supabase Auth configuration, account-first onboarding and active subscription or trial. Set `NEXT_PUBLIC_BASE_URL` to the canonical HTTPS origin before building. Placard links and downloads embed this origin.

Sign in as the pilot owner, open **Tap**, select the location or create the first one, and enter its IANA time zone and placard placement. Copy the customer URL to the NFC tag and print the downloadable QR. Keep the marketing business card pointed at the website. Submit a test visit from **Preview and test form**. Opening the published customer link starts a real visit.

Set `OPENAI_API_KEY`, a structured-output-capable `OPENAI_MODEL`, and `CRON_SECRET`. Schedule the two bearer-authenticated GET routes in `vercel.json`. The minute worker claims feedback analysis and advances due provider actions. The daily worker saves the previous local quarter and removes old encounters. Use a scheduler that supports the specified frequency. The database holds jobs between invocations. Failed analysis backs off, and the owner can retry from Feedback.

The analysis worker starts up to four concurrent calls per wave, claims at most 24 jobs per invocation, and stops starting waves after eight seconds. An in-flight call has its own 30-second deadline. A successful claim moves that location behind other locations with eligible work. Rating-only visits enter the inbox immediately. Opening a new placard link starts a new encounter. Refreshing the submitted form URL returns the receipt for a committed visit or reopens the same unsubmitted encounter.

A theme needs two distinct submissions to qualify as recurring. Quarterly selection gives urgent recurring issues priority, then uses distinct mention count and theme name. A plan started early retains its original evidence, denominator, local quarter and capture time. The inbox continues to reflect later visits and owner corrections. Opening a plan from a filtered issue saves a theme-specific plan for the quarter containing the filter end date. Test visits and test runs are stored separately by mode. Test provider amounts and receipts are fictional.

## Provider channel

Google Places discovery uses the existing `GOOGLE_PLACES_API_KEY`. Alternatively the gateway can implement discovery. An address returned by Places is a research lead. Written terms establish service scope and availability. The pilot compares USD all-in quotes.

For external actions, the deployment operator must supply an HTTPS service-provider gateway that implements the contract below and connects to actual provider channels. Provider-specific email delivery, reply verification and reservation APIs belong behind that gateway. Existing marketing email, Google Business and Stripe credentials do not supply this capability. Verify the gateway on its test destinations first, including a lost response after a successful request and changed terms at booking.

Configure `PILOT_PROVIDER_URL`, `PILOT_PROVIDER_TOKEN`, `PILOT_PROVIDER_LOCATION_ID` (the selected restaurants row UUID), and `PILOT_PROVIDER_LIVE=true` to enable live actions for that location. Settings → Provider integrations shows local configuration. Each real action additionally requires checked capabilities and the run’s current owner authorization. Disabling dispatch must leave reconciliation available for previously sent actions.

### Protocol

All gateway requests use bearer authentication and HTTPS. The URL is deployment configuration. Requests never follow redirects. No customer comments or owner incident notes are included in provider messages. The gateway receives the owner-approved service scope, service address or area, window and time zone, and the relevant provider, quote or appointment reference.

| Request | Required behavior |
| --- | --- |
| GET `/capabilities` | Return `verified`, `idempotency`, `reconciliation` and `conditionalBooking` as true and an `operations` array. Advertise only end-to-end supported operations. |
| POST `/actions` | Receive the JSON request described by `outbound` and the durable `Idempotency-Key`. Persist the key before delivery. A replay of that key returns the same receipt. |
| GET `/actions/{key}` | Return `{"status":"confirmed","receipt":{...}}`, `{"status":"pending"}`, or authoritative `{"status":"absent"}`. Absent means the original action cannot subsequently commit. Return pending for an unknown outcome. |

Operation and receipt types are defined in `lib/pilot/providers.ts` and `lib/pilot/workflow.ts`.

| Operation | Receipt |
| --- | --- |
| discover | Up to ten providers with stable IDs, names, HTTPS source URLs, areas, service fit and published estimate text when available. |
| outreach | Written quote request message and durable channel reference. Route the stable provider ID to its verified contact destination. |
| quotes | Full current collection of written quotes and a completion flag. Include scope, all-in total in integer cents, USD, date, terms, expiry and verified source reference. Return incomplete while responses are pending. |
| book | Atomically accept only the supplied exact quote within its service window. If terms change before commitment, return `changed:true` and the provider's explanation without reserving. A committed receipt includes the actual appointment, date, provider, accepted quote and confirmation reference. |
| reschedule | Use the supplied existing appointment reference. Change only within the new window and authorized exact terms. Return the amended confirmation, or a changed-terms response requiring owner review. |
| cancel | Explicit cancellation of the named appointment with a provider message and cancellation reference. |

Never treat an estimate, a sent email, an HTTP timeout or an unconfirmed reservation request as a booking. The worker journals committed and uncertain operations. A pause stops new dispatch while outstanding actions are reconciled. Budget or preference edits rerank valid quotes. Scope, area or window edits invalidate affected research or quote work. Committed appointments require a separate, explicitly confirmed change.

The controlled release provisions the Tap minute and daily triggers separately using authenticated Supabase Cron jobs. Follow the [production activation checklist](tap-release.md) before enabling either job. Legacy Vercel schedules retain their existing configuration.

## Checks

Run `npm test` and `npm run verify`. The pilot tests exercise migrations through 034 in PostgreSQL-compatible PGlite, encounter consumption, expiry, tenant boundaries, immutable snapshots, worker leases, quote eligibility, lost acknowledgements and appointment changes. The existing staging suites require the dedicated `.env.staging.local` described in `tests/staging/README.md`. Actual pilot provisioning, deployment and live provider acceptance are separate launch operations.

### Repeat the isolated browser rehearsal

`npm run test:pilot:browser` exercises real Next.js routes and forms against disposable PostgreSQL and PostgREST on loopback. The fixture supplies its own authenticated test identity, AI response and provider receipts. It copies the site without environment files, generates ephemeral credentials, and removes its database after the run. It requires free ports 3673, 3674, 3675 and 54365.

Install the optional `embedded-postgres` package into a tools directory using `npm install --prefix <tools-directory> embedded-postgres@18.7.0-beta.19`. Set `PILOT_LOCAL_TOOLS` to that directory. Supply the PostgREST 16.6 executable via `POSTGREST_BIN`, or put it in the tools directory under `bin/postgrest.exe` on Windows or `bin/postgrest` elsewhere. The default tools directory is `replova-pilot-local` inside the operating system temp directory. Install the test browser with `npx playwright-core install chromium`.
