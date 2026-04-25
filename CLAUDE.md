# Replova

Restaurant reputation management SaaS. AI-powered review reply generation, sentiment analysis, competitor tracking, review request campaigns, and weekly digest emails.

Stack: Next.js (App Router), TypeScript, Tailwind CSS, Supabase, Claude API, Resend, Stripe, Vercel.

Run dev server: `npm run dev`
Never commit `.env.local`. All secrets go in `.env.local` only.

---

## Directory Structure

```
app/api/              # API route handlers
app/dashboard/        # Dashboard UI pages
app/onboard/          # Signup/onboarding flow
app/signin/           # Login page (magic link)
app/auth/             # Supabase auth callback
app/privacy/          # Privacy policy
app/terms/            # Terms of service
app/refunds/          # Refund policy
lib/                  # Core business logic
components/           # Shared UI components
components/dashboard/ # Dashboard-specific components
utils/supabase/       # Supabase client helpers (client.ts, server.ts, middleware.ts)
supabase/             # DB migrations
```

---

## API Routes

### Auth & Google My Business
- `POST api/auth/magic-link/` — Sends OTP magic link; checks `accounts` table first (rejects unknown emails with 404), uses `shouldCreateUser: false`
- `GET  api/auth/google/` — Initiates Google OAuth for GMB connection
- `POST api/auth/google/callback/` — Exchanges code for tokens, saves to restaurants table
- `GET  api/auth/google/locations/` — Lists GMB locations for authenticated user
- `POST api/auth/google/set-location/` — Associates a GMB location with restaurant

### Reviews & Replies
- `POST api/sync-reviews/` — User-triggered sync: fetches GMB reviews, dedupes, generates reply drafts
- `POST api/fetch-reviews/` — Fetches reviews for a specific restaurant (protected by CRON_SECRET)
- `POST api/replies/generate/` — Queues a review for AI reply generation
- `POST api/replies/approve/` — Approves a queued reply
- `POST api/reviews/mark-replied/` — Marks review as replied (local status)
- `POST api/post-reply/` — Posts approved reply to GMB via API

### Sentiment & Scoring
- `POST api/sentiment/analyze/` — Analyzes review sentiment with Claude Haiku, saves keywords & staff mentions
- `GET  api/score/[restaurantId]/` — Returns reputation score breakdown

### Review Requests (Solicitation)
- `POST api/review-requests/send/` — Sends review request email to a customer
- `GET  api/review-requests/list/` — Lists all review requests for a restaurant
- `GET  api/review-requests/stats/` — Returns engagement stats (sent, opened, clicked)
- `GET  api/review-requests/track/` — Tracks email opens & link clicks
- `POST api/review-requests/upload/` — Bulk imports customers from CSV

### Competitors
- `GET    api/competitors/` — Lists tracked competitors with latest snapshots
- `POST   api/competitors/` — Adds a competitor (enforces plan limit)
- `DELETE api/competitors/` — Soft-deletes competitor (sets active: false)
- `GET    api/competitors/search/` — Searches Google Places for competitors
- `POST   api/competitors/auto-discover/` — Auto-discovers competitors by cuisine/location
- `GET    api/competitors/comparison/` — Returns rating comparison and ranking data

### Billing (Stripe)
- `GET  api/create-checkout/` — Creates Stripe checkout session (30-day trial); accepts `?plan=starter|growth|agency`
- `GET  api/billing-portal/` — Redirects to Stripe customer portal (change plan, cancel, update payment)
- `POST api/webhooks/stripe/` — Handles: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`

### Restaurant & Account
- `GET   api/restaurant/` — Returns current restaurant info with plan and connectivity status
- `GET   api/active-location/` — Returns active location from cookie (multi-location support)
- `PATCH api/settings/` — Updates restaurant_settings (persona requires Agency; logo_url requires Agency)
- `POST  api/terms/accept/` — Records terms acceptance timestamp on accounts row
- `POST  api/account/delete/` — Deletes account and all restaurants
- `POST  api/restaurants/create/` — Creates new restaurant record during onboarding

### Other
- `POST api/onboard/search-place/` — Searches Google Places during signup
- `GET  api/reports/monthly/` — Generates monthly PDF report (white-label logo for Agency)
- `POST api/alerts/test/` — Sends a test negative review alert email

### Cron Jobs (Vercel scheduled)
| Route | Schedule | Purpose |
|-------|----------|---------|
| `api/cron/sync-all-reviews/` | Every 6h | Syncs reviews for all active restaurants |
| `api/cron/process-reply-queue/` | Every 15m | Sends queued replies to GMB |
| `api/cron/update-scores/` | Daily 3am | Recalculates reputation scores |
| `api/cron/sync-competitors/` | Daily 4am | Snapshots competitor ratings |
| `api/cron/analyze-sentiment/` | Daily | Batch analyzes pending reviews |
| `api/cron/weekly-digest/` | Monday 9am | Sends weekly digest emails |

All cron routes require `Authorization: Bearer <CRON_SECRET>` header.

---

## Dashboard Pages

- `dashboard/` — Main view: review list, reputation score, keyword cloud, staff mentions
- `dashboard/settings/` — Google connection, auto-reply toggle, notification prefs, custom persona, digest schedule
- `dashboard/billing/` — Subscription status, plan selector (all 3 tiers with upgrade/downgrade), trial progress bar, usage bars, feature list
- `dashboard/competitors/` — Search & track competitors, rating comparison chart
- `dashboard/review-requests/` — Send requests, CSV upload, engagement stats

Key components:
- `ReviewList.tsx` — Review list with filters (status, rating, sentiment)
- `PostReplyButton.tsx` — Posts approved reply to GMB inline
- `components/dashboard/IntelligencePanel.tsx` — Sidebar: score, response rate, sentiment trend, top keywords, staff shoutouts, competitor link
- `components/dashboard/LocationSwitcherClient.tsx` — Switches active location (multi-location accounts)
- `TermsModal.tsx` — Terms acceptance modal (checks `terms_accepted_at` on accounts row)
- `AutoDismissBanner.tsx` — Auto-dismissing notification banner
- `DemoMode.tsx` — Demo mode indicator/banner

---

## Core Lib Files

| File | Purpose |
|------|---------|
| `lib/supabase.ts` | Admin (service role) and browser Supabase clients |
| `lib/generateReplies.ts` | 3 reply variants via Claude Sonnet (professional, warm, brief) |
| `lib/generateSingleReply.ts` | Single reply with custom persona for auto-reply |
| `lib/sentiment.ts` | Sentiment analysis + keyword/staff/menu extraction via Claude Haiku |
| `lib/syncReviews.ts` | Core sync: fetch GMB/Places → dedupe → generate replies → send alerts; concurrency via p-limit |
| `lib/replyQueue.ts` | Reply queue management (queue, approve, scheduled send to GMB) |
| `lib/reputationScore.ts` | Composite score: 35% rating, 20% volume, 25% response rate, 20% sentiment |
| `lib/planLimits.ts` | Per-plan feature gates: locations, competitors, sentiment, scores, PDF, persona, white-label |
| `lib/places.ts` | Google Places search, place details & rating snapshots |
| `lib/googleAuth.ts` | Google OAuth token refresh (5-min expiry buffer) |
| `lib/myBusiness.ts` | Fetches reviews from GMB API with pagination |
| `lib/competitors.ts` | Competitor tracking and daily rating snapshots |
| `lib/reviewRequests.ts` | Email templates for review requests with open/click tracking |
| `lib/alerts.ts` | Negative review alert emails with suggested replies |
| `lib/sendDigest.ts` | Weekly digest email with AI-generated action items |
| `lib/pdfReport.tsx` | Monthly PDF report via @react-pdf/renderer (white-label for Agency) |
| `lib/activeLocation.ts` | Manages active location cookie for multi-location support |
| `lib/baseUrl.ts` | Resolves BASE_URL from env or Vercel URL |
| `lib/database.types.ts` | TypeScript types for all Supabase tables |

---

## Database Schema

### Core Tables
- **restaurants** — id, name, place_id, owner_email, active, google OAuth tokens, google_location_name, report_logo_url
- **reviews** — id, restaurant_id, google_review_name, author, rating, review_text, review_timestamp, reply_draft_{1,2,3}, status, replied_at, owner_reply_text, sentiment fields (score, label, summary, keywords[], staff_mentions[], menu_mentions[])

### Extended Tables (from migrations)
- **accounts** — owner_email (unique), plan (starter/growth/agency), stripe_customer_id, created_at, terms_accepted_at
- **restaurant_settings** — auto_reply (bool), notifications (bool), persona (text), digest schedule, recovery offers config
- **reply_queue** — review_id, restaurant_id, generated/edited reply, scheduled_send_at, approved (bool), sent (bool)
- **reputation_scores** — daily snapshot: composite score (0–100), avg_rating, total_reviews, reviews_this_month, response_rate, avg_sentiment
- **review_requests** — customer name/email/phone, channel (email/sms), sent_at, opened_at, clicked_at
- **competitors** — restaurant_id, place_id, name, address, active (bool)
- **competitor_snapshots** — competitor_id, rating, review_count, snapshotted_at

> `plan` and `stripe_customer_id` live on `accounts`, not `restaurants`. Always query `accounts` for billing/plan info.

---

## Plans & Pricing

| Plan | Price | Locations | Competitors/location | Extras |
|------|-------|-----------|----------------------|--------|
| Starter | $39/mo | 1 | 3 | — |
| Growth | $99/mo | 5 | 5 | Sentiment, scores, PDF reports |
| Agency | $199/mo | 15 | 10 | + Custom persona, white-label reports |

Plan limits and feature gates defined in `lib/planLimits.ts`. All plans include: AI reply drafts, urgent review alerts, weekly digest, review request campaigns.

---

## Key Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY   # alternate anon key alias
SUPABASE_SERVICE_ROLE_KEY

# Google
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_PLACES_API_KEY

# AI
ANTHROPIC_API_KEY

# Payments
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ID                        # fallback (defaults to growth)
STRIPE_PRICE_ID_STARTER
STRIPE_PRICE_ID_GROWTH
STRIPE_PRICE_ID_AGENCY

# Email
RESEND_API_KEY
RESEND_FROM_EMAIL                      # defaults to alerts@replova.com

# App
NEXT_PUBLIC_BASE_URL
NEXT_PUBLIC_APP_URL
CRON_SECRET                            # Bearer token for cron route auth
```

---

## Key Dependencies

- `@anthropic-ai/sdk` — Claude API (reply generation, sentiment)
- `@supabase/ssr` + `@supabase/supabase-js` — Supabase SSR & browser clients
- `stripe` — Billing
- `resend` — Email delivery
- `@react-pdf/renderer` — PDF report generation
- `papaparse` — CSV parsing for bulk review request imports
- `p-limit` — Concurrency control for AI batch tasks (concurrency=5 in sync)

---

## Auth Notes

- Magic link is the only sign-in method. `api/auth/magic-link` validates the email exists in `accounts` before sending — unknown emails get a 404, not a magic link. Sign-in page calls this API route (not Supabase directly).
- Google OAuth is for GMB integration only, not user login.
- All server-side Supabase calls use the service role key (no RLS). Access control is enforced at the API route level via `user.email`.
- Multi-location accounts use a cookie to track active location (`lib/activeLocation.ts`, `api/active-location/`).

## Billing Notes

- 30-day trial via Stripe checkout `trial_period_days: 30`.
- `inTrial` = restaurant active AND no `stripe_customer_id` AND within 30 days of `restaurant.created_at`. If user completed checkout during trial, trial end date comes from Stripe (`sub.trial_end`).
- Plan changes and cancellations go through the Stripe billing portal (`/api/billing-portal`). Proration handled by Stripe.
- Stripe webhook keeps `accounts.plan` and `restaurants.active` in sync with subscription state.
- Billing page always shows all three plan tiers with upgrade/downgrade buttons regardless of Stripe status.
