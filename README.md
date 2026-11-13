# Replova

Replova is a Google review operations and reputation intelligence platform for any local business. It monitors reviews, generates three on-brand reply options with OpenAI, publishes approved replies to Google Business Profile, requests new reviews from recent customers, and turns feedback into themes, trends, scores, alerts, competitor comparisons, and reports.

## Product surface

- Public: landing page, industries, resources, careers/application flow, onboarding, sign-in, privacy, terms, and refunds
- Dashboard: review center, reputation intelligence, competitor tracking, review requests, settings, and billing
- Automation: review sync, queued replies, score calculation, sentiment analysis, competitor snapshots, and weekly digest emails
- Integrations: Supabase, Google Places and Business Profile, OpenAI Responses API, Stripe, Resend, and Vercel

The feature and security contract lives in [AGENTS.md](./AGENTS.md). Preserve it when changing the product.

## Repository map

```text
app/
  api/                 Authenticated APIs, webhooks, and cron handlers
  careers/             Careers page and application form
  demo/                Demo scheduling preview
  dashboard/           Authenticated product UI
  dashboard-preview/   Public sample-data dashboard (never reads customer data)
  industries/          Industry use cases
  resources/           Public operator guides
  onboard/             Business search and signup
components/            Shared UI and marketing chrome
lib/                   Business logic and service integrations
public/                Shipped brand and social assets
supabase/migrations/   Ordered database schema and migrations
utils/supabase/        Browser, server, and middleware clients
proxy.ts               Next.js request/session proxy
vercel.json            Production cron schedule
```

Some internal names—`restaurants`, `restaurant_id`, `cuisine_type`, and `/api/restaurants/create`—are legacy database/API contracts. The product is category-agnostic; do not rename those internals without a planned migration.

## Local setup

Requirements: Node.js 22+, npm, a Supabase project, and credentials for the services below.

```bash
npm ci
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Useful no-configuration previews:

- `http://localhost:3000/dashboard-preview` shows the dashboard with sample data and never authenticates or reads customer records.
- `http://localhost:3000/demo` shows the demo-scheduling experience; booking delivery remains intentionally disconnected until a calendar provider is configured.
- `http://localhost:3000/signin` shows the production sign-in UI. Real email magic links require the Supabase values below.

Run the full local verification suite before pushing:

```bash
npm run verify
```

Individual commands are `npm run lint`, `npm run typecheck`, and `npm run build`.

## Environment variables

Copy `.env.example` to `.env.local`. Never commit real secrets.

| Group | Required values |
| --- | --- |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| App URLs | `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_APP_URL` |
| Google | `GOOGLE_PLACES_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| OpenAI | `OPENAI_API_KEY`; `OPENAI_MODEL` defaults to `gpt-6-luna` |
| Resend | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CAREERS_EMAIL` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the three `STRIPE_PRICE_ID_*` values |
| Automation | `CRON_SECRET` |

Optional values include Google Analytics, API-budget alert email, and custom OpenAI per-million-token pricing. See `.env.example` for the exact names.

## Service configuration

### Supabase

1. Create a project and add the URL, anonymous key, and service-role key to the environment.
2. Apply every SQL file in `supabase/migrations` in numeric order. `000_base_schema.sql` makes a new project bootstrappable; later files add product features and integrity fixes.
3. Add these authentication redirect URLs:
   - Local: `http://localhost:3000/auth/callback`
   - Local magic link: `http://localhost:3000/signin`
   - Production: `https://YOUR_DOMAIN/auth/callback`
   - Production magic link: `https://YOUR_DOMAIN/signin`
4. Keep email OTP enabled. Replova uses magic links only and never password authentication.

`supabase-schema.sql` documents the small legacy base schema. The ordered migrations are the deployment source of truth.

### Google

1. Enable the Google Places API and the Google Business Profile APIs required for account/location/review access.
2. Create an OAuth web client.
3. Add `https://YOUR_DOMAIN/api/auth/google/callback` and the local equivalent as authorized redirect URIs.
4. Complete any Google verification required before external users connect Business Profiles.

Google OAuth connects a Business Profile; it is not used to authenticate Replova users.

### OpenAI

Create an API key with access to the configured model. All generative calls go through `lib/openai.ts`, use the Responses API, request non-persistent responses, and use strict structured output for machine-readable tasks.

### Stripe

1. Create monthly Starter, Growth, and Agency prices and set the three price IDs.
2. Point a webhook endpoint to `https://YOUR_DOMAIN/api/webhooks/stripe`.
3. Subscribe it to the checkout/subscription events handled by the route and copy the signing secret.
4. Enable the Stripe customer portal for plan changes and cancellation.

### Resend

1. Verify the sending domain used by `RESEND_FROM_EMAIL`.
2. Set `CAREERS_EMAIL` to the inbox that should receive internship applications and optional résumé attachments.
3. Set `DEV_ALERT_EMAIL` only if API-budget alerts should be delivered.

### Vercel cron

Set a long random `CRON_SECRET` in Vercel. The schedules in `vercel.json` call protected routes with `Authorization: Bearer <CRON_SECRET>`. Confirm that the selected Vercel plan supports the configured 15-minute job frequency.

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import it into Vercel with Node.js 22.
3. Add all production environment variables for Production and Preview as appropriate.
4. Deploy, then add the final Vercel/custom domain to Supabase and Google redirect allowlists.
5. Register the production Stripe webhook and run a real test-mode checkout.
6. Verify a magic-link login, Google connection, review sync, reply publish, review-request email, careers application, billing portal, and one authorized cron request.

GitHub Actions runs lint, type-checking, and a production build on pushes and pull requests.

## Security invariants

- Server routes authenticate with the Supabase session and scope data by the signed-in owner.
- Service-role database access remains server-only.
- Google OAuth state is verified and location selection is checked against the connected account.
- Stripe webhooks verify their signature.
- Cron endpoints require the shared bearer secret.
- OpenAI and all other private API keys remain server-only.
- Career attachments are optional, restricted to PDF/DOC/DOCX, and capped at 4 MB.

## License

See [LICENSE](./LICENSE).
