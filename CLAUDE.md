# Replova

Restaurant reputation management SaaS. $99/month. AI-powered review reply generation, sentiment analysis, competitor tracking, review request campaigns, and weekly digest emails.

Stack: Next.js (App Router), TypeScript, Tailwind CSS, Supabase, Claude API, Resend, Stripe, Vercel.

Run dev server: `npm run dev`
Never commit `.env.local`. All secrets go in `.env.local` only.

---

## Directory Structure

```
app/api/          # API route handlers
app/dashboard/    # Dashboard UI pages
app/onboard/      # Signup flow
app/signin/       # Login page
app/auth/         # Supabase auth callback
lib/              # Core business logic
components/       # Shared UI components
utils/supabase/   # Supabase client helpers
supabase/         # DB migrations
```

---

## API Routes

### Auth & Google My Business
- `api/auth/google/` — Initiates Google OAuth for GMB connection
- `api/auth/google/callback/` — Exchanges code for tokens, saves to restaurants table
- `api/auth/google/locations/` — Lists GMB locations for authenticated user
- `api/auth/google/set-location/` — Associates a GMB location with restaurant
- `api/auth/magic-link/` — Sends passwordless magic link email

### Reviews & Replies
- `api/sync-reviews/` — Manual sync trigger: fetches GMB reviews, dedupes, generates replies
- `api/fetch-reviews/` — Fetches reviews from Google Places API
- `api/replies/generate/` — Generates 3 AI reply variants (professional, warm, brief)
- `api/replies/approve/` — Approves a generated reply for the queue
- `api/reviews/mark-replied/` — Marks review as replied
- `api/post-reply/` — Posts approved reply to GMB

### Sentiment
- `api/sentiment/analyze/` — Analyzes review sentiment with Claude Haiku, saves keywords & staff mentions

### Review Requests (Solicitation)
- `api/review-requests/send/` — Sends review request email to a customer
- `api/review-requests/list/` — Lists all review requests for a restaurant
- `api/review-requests/stats/` — Returns engagement stats (sent, opened, clicked)
- `api/review-requests/track/` — Tracks email opens & link clicks
- `api/review-requests/upload/` — Bulk imports customers from CSV

### Competitors
- `api/competitors/` — Lists tracked competitors
- `api/competitors/search/` — Searches Google Places for competitors
- `api/competitors/comparison/` — Returns rating comparison data

### Billing (Stripe)
- `api/create-checkout/` — Creates Stripe checkout session (30-day trial)
- `api/billing-portal/` — Redirects to Stripe customer portal
- `api/webhooks/stripe/` — Handles subscription events (checkout completed, subscription deleted)

### Restaurant
- `api/restaurants/create/` — Creates new restaurant record
- `api/restaurant/` — Gets restaurant details
- `api/score/[restaurantId]/` — Returns reputation score
- `api/settings/` — Gets/updates restaurant settings
- `api/account/delete/` — Deletes restaurant and all data

### Other
- `api/onboard/search-place/` — Searches Google Places during signup
- `api/reports/monthly/` — Generates monthly PDF report
- `api/alerts/test/` — Sends a test negative review alert email

### Cron Jobs (Vercel scheduled)
| Cron | Schedule | Purpose |
|------|----------|---------|
| `api/cron/sync-all-reviews/` | Every 6h | Syncs reviews for all active restaurants |
| `api/cron/process-reply-queue/` | Every 15m | Sends queued replies to GMB |
| `api/cron/update-scores/` | Daily 3am | Recalculates reputation scores |
| `api/cron/sync-competitors/` | Daily 4am | Snapshots competitor ratings |
| `api/cron/analyze-sentiment/` | — | Batch analyzes pending reviews |
| `api/cron/weekly-digest/` | Monday 9am | Sends weekly digest emails |

All cron routes require `Authorization: Bearer <CRON_SECRET>` header.

---

## Dashboard Pages

- `dashboard/` — Main view: review list, reputation score, keyword cloud, staff mentions
- `dashboard/settings/` — Auto-reply toggle, notification prefs, custom persona, digest schedule
- `dashboard/billing/` — Trial status, days remaining, upgrade button
- `dashboard/competitors/` — Search & track competitors, rating comparison chart
- `dashboard/review-requests/` — Send requests, CSV upload, engagement stats

Key components:
- `ReviewList.tsx` — Review list with filters (status, rating, sentiment)
- `PostReplyButton.tsx` — Posts approved reply to GMB
- `components/dashboard/IntelligencePanel.tsx` — Sidebar: score, response rate, sentiment trend, top keywords, staff shoutouts, competitor link

---

## Core Lib Files

| File | Purpose |
|------|---------|
| `lib/supabase.ts` | Admin (service role) and browser Supabase clients |
| `lib/generateReplies.ts` | 3 reply variants via Claude Sonnet (professional, warm, brief) |
| `lib/generateSingleReply.ts` | Single reply with custom persona for auto-reply |
| `lib/sentiment.ts` | Sentiment analysis + keyword/staff extraction via Claude Haiku |
| `lib/syncReviews.ts` | Core sync: fetch GMB → dedupe → generate replies → send alerts |
| `lib/replyQueue.ts` | Reply queue management (generate, edit, approve, post to GMB) |
| `lib/reputationScore.ts` | Composite score: 35% rating, 20% volume, 25% response rate, 20% sentiment |
| `lib/places.ts` | Google Places search, place details & ratings |
| `lib/googleAuth.ts` | Google OAuth token refresh (5-min expiry buffer) |
| `lib/myBusiness.ts` | Fetches reviews from GMB API with pagination |
| `lib/competitors.ts` | Competitor tracking and daily rating snapshots |
| `lib/reviewRequests.ts` | Email templates for review requests with tracking |
| `lib/alerts.ts` | Negative review alert emails with suggested replies |
| `lib/sendDigest.ts` | Weekly digest email with AI-generated action items |
| `lib/pdfReport.tsx` | Monthly PDF report via @react-pdf/renderer |
| `lib/baseUrl.ts` | Resolves BASE_URL from env or Vercel URL |
| `lib/database.types.ts` | TypeScript types for all Supabase tables |

---

## Database Schema

### Core Tables
- **restaurants** — id, name, place_id, owner_email, active, stripe_customer_id, google OAuth tokens, google_location_name
- **reviews** — id, restaurant_id, google_review_name, author, rating, review_text, review_timestamp, reply_draft_{1,2,3}, status, replied_at, owner_reply_text, sentiment fields (score, label, summary, keywords[], staff_mentions[], menu_mentions[])

### Extended Tables (from migrations)
- **restaurant_settings** — auto_reply (bool), notifications (bool), persona (text), digest schedule, recovery offers config
- **reply_queue** — review_id, restaurant_id, generated/edited reply, scheduled_send_at, approved (bool), sent (bool)
- **reputation_scores** — daily snapshot: composite score (0–100), avg_rating, total_reviews, reviews_this_month, response_rate, avg_sentiment
- **review_requests** — customer name/email/phone, channel (email/sms), sent_at, opened_at, clicked_at
- **competitors** — restaurant_id, place_id, name, address
- **competitor_snapshots** — competitor_id, rating, review_count, snapshotted_at

---

## Key Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
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
STRIPE_PRICE_ID

# Email
RESEND_API_KEY
RESEND_FROM_EMAIL          # defaults to alerts@replova.com

# App
NEXT_PUBLIC_BASE_URL
NEXT_PUBLIC_APP_URL
CRON_SECRET                # Bearer token for cron auth
```

---

## Key Dependencies

- `@anthropic-ai/sdk` — Claude API (reply generation, sentiment)
- `@supabase/ssr` + `@supabase/supabase-js` — Supabase SSR & browser clients
- `stripe` — Billing
- `resend` — Email delivery
- `@react-pdf/renderer` — PDF report generation
- `papaparse` — CSV parsing for bulk review request imports
- `p-limit` — Concurrency control for AI batch tasks
