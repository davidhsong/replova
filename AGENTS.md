<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

---

# Replova — Feature Brief

**Purpose of this file:** Every page, feature, and behavior listed here MUST remain intact after any change. Before submitting work, verify that nothing on this list was accidentally broken or removed. This is the canonical record of what the product does.

---

## Pages

### `/` — Landing page

- Marketing page promoting Replova
- Links to `/onboard` (sign up) and `/signin` (log in)

### `/signin` — Sign-in page

- Email input → sends magic link via `POST /api/auth/magic-link`
- Shows "Check your email" confirmation state after submit
- Shows inline error if email is not registered ("No account found for this email")
- Does NOT call Supabase directly — always routes through the API
- Link to `/onboard` for new users

### `/onboard` — Onboarding / sign-up flow

- Google Places search to find the restaurant
- Creates restaurant record via `POST /api/restaurants/create`
- Sends user into Stripe checkout for plan selection

### `/auth/callback` — Auth callback

- Handles Supabase magic link callback (`token_hash` + `type`) and Google OAuth code exchange
- Redirects to `/dashboard` on success

### `/privacy`, `/terms`, `/refunds` — Policy pages

- Static legal/policy pages

---

## Dashboard pages (require active session + restaurant)

### `/dashboard` — Review Center (main dashboard)

**Header:**

- Restaurant name as page title
- "Monitoring" status indicator (green pulse dot)
- Banner: "Connect Google Business" (amber) if `google_location_name` is null and no `?success` param
- Banner: "You're all set" (green, auto-dismisses after 4s) when `?success=true` in URL
- Urgent/all-clear banner (red/amber/green) based on unreplied + urgent count

**Stats strip (4 cards):**

1. **Replova Score** — composite 0–100; shows week-over-week delta (▲/▼) badge
2. **Google Rating** — avg star rating (gold); "last 90 days" label
3. **New Reviews** — reviews this month count
4. **Awaiting Reply** — unreplied count; turns red background when > 0, green "✓ all caught up" when 0

**Review inbox (ReviewList component):**

- List of up to 25 most recent reviews, ordered by `review_timestamp` desc
- Filter controls: by status, rating, sentiment
- Each review card shows: author, star rating, review text, sentiment label, timestamp
- 3 AI reply draft variants (Professional / Warm / Brief) — click to expand/select
- "Post reply" button (PostReplyButton) to submit to GMB
- "Mark replied" option
- Demo mode shown (DemoMode component) when no reviews exist yet

**Intelligence panel (IntelligencePanel component, sidebar):**

- Reputation score with arc gauge
- Response rate
- Sentiment trend
- Top keywords (from last 30 days of reviews)
- Staff shoutouts (positive reviews, last 30 days)
- Link to competitors page (if competitors have been added)
- Plan-gated: score and sentiment panels only shown on Growth/Agency

**Inactive state:** If `restaurant.active = false`, shows a "Start your free 30-day trial" CTA instead of the dashboard.

---

### `/dashboard/settings` — Settings

**Sections:**

1. **Sync reviews** — "Sync now" button → `POST /api/sync-reviews`; shows result: new reviews, drafts generated, auto-marked replied

2. **Google Business** — 4 states:
   - `loading` — skeleton placeholder
   - `connected` — green pulse dot + "Connected" + "Reconnect" link
   - `token_only` — amber dot, shows list of GMB locations to select; calls `POST /api/auth/google/set-location` on pick
   - `not_connected` — "Connect Google Business" button → `/api/auth/google`
   - Handles `?google_success`, `?google_warning`, `?google_error` URL params with inline banners

3. **Reply settings** (loaded from `GET /api/settings`, saved via `PATCH /api/settings`):
   - Toggle: **Auto-reply to reviews** (on/off)
   - Input: **Delay before sending** (1–24 hours)
   - Textarea: **Reply voice / persona** — Agency plan only; shows locked UI + "Upgrade" link for non-Agency
   - Toggle: **Alert me on low ratings** (on/off)
   - Star picker: **Alert threshold** (1–5 stars)
   - "Save settings" button with success/error feedback

4. **Report branding** — Agency only; input for logo URL; saved via `PATCH /api/settings`

5. **Account** — displays email address (read-only, cannot be changed)

6. **Danger zone** — "Delete account" button with 2-step confirmation; calls `POST /api/account/delete`, signs out, redirects to `/`

---

### `/dashboard/billing` — Billing

**Status card:**

- Current plan name + price per month
- Active / Free trial / Inactive badge
- Trial progress bar (day X of 30, days remaining, first charge date) — shown when in trial
- Renewal date (if on active paid subscription)
- CTAs based on state:
  - Has Stripe customer → "Manage subscription" → `/api/billing-portal`
  - No Stripe, active trial → "Add payment method" → `/api/create-checkout` + "No charge until [date]"
  - Inactive → "Reactivate subscription" → `/api/create-checkout`

**Choose your plan (always visible):**

- 3 plan cards: Starter ($39), Growth ($99), Agency ($199)
- Current plan highlighted with "Current plan" badge
- Each card shows: price, locations, competitor slots
- Non-current plans show upgrade/downgrade buttons:
  - Upgrade → `/api/billing-portal` (if has Stripe) or `/api/create-checkout?plan=X` (if no Stripe)
  - Downgrade → same routing
- Note about Stripe proration for Stripe customers

**Plan usage:**

- Locations progress bar (X / limit, colors: green → warn → red at 80%/100%)
- Competitors tracked (X tracked · N slots/location)

**What's included:**

- All plans: AI reply drafts, urgent review alerts, weekly digest, review request campaigns
- Growth & Agency (locked at opacity 0.4 for Starter): reputation score, sentiment analysis, competitor tracking, monthly PDF report
- Agency only (locked for non-Agency): custom reply persona, white-label PDF reports, up to 15 locations

**Help section:** Email link to support@replova.app

---

### `/dashboard/competitors` — Competitor Tracking

**Your position card:**

- Rank badge (#1 = gold, #2 = silver, #3 = bronze)
- "You are ranked #X of N restaurants you're tracking"
- Your avg rating + total review count

**Add competitor card:**

- Search input (debounced 500ms) → `GET /api/competitors/search?q=`
- Dropdown results: name, address, star rating; "Add" / "Added" state per result
- **Auto-discover nearby** button → `POST /api/competitors/auto-discover`; auto-runs silently on first visit if no competitors added yet
- Slot counter: "X / N competitor slots used"
- At-limit state: "Limit reached. Upgrade to add more" → `/dashboard/billing`

**Comparison table:**

- Columns: Rank, Restaurant, Rating, Reviews, vs. You
- "You" row highlighted with accent background + "You" badge
- vs. You delta: competitor rating minus your rating (positive = they beat you, shown red; negative = you beat them, shown green)
- Remove button (trash icon) per competitor row

**Empty state:** shown when no competitors added yet

---

### `/dashboard/review-requests` — Review Requests

**Stats row (4 cards):**

- Sent (total sent + opened + clicked)
- Opened (count + open rate %)
- Clicked (count)
- Click Rate (% of sent)

**Upload Contacts card:**

- CSV format instructions (name, email columns)
- Drag-and-drop zone + click-to-browse file picker (`.csv` only)
- Upload result banner: "Imported X customers (Y skipped — reasons)"
- Send result banner: "Sent X emails · N failed"
- **Send All (N)** button → `POST /api/review-requests/send`; disabled when pending count is 0

**Recent Requests table:**

- Columns: Customer, Email, Status, Sent date
- Status badges: Pending (zinc), Sent, Opened (amber), Clicked (green)
- Empty state: "No requests yet — upload a CSV to get started"

---

## Always-on background behaviors

These run without user interaction and must not be broken by changes:

| Behavior                    | Trigger    | Route                          |
| --------------------------- | ---------- | ------------------------------ |
| Auto-sync reviews           | Every 6h   | `api/cron/sync-all-reviews`    |
| Post queued replies         | Every 15m  | `api/cron/process-reply-queue` |
| Recalculate scores          | Daily 3am  | `api/cron/update-scores`       |
| Snapshot competitor ratings | Daily 4am  | `api/cron/sync-competitors`    |
| Batch sentiment analysis    | Daily      | `api/cron/analyze-sentiment`   |
| Send weekly digest emails   | Monday 9am | `api/cron/weekly-digest`       |

All cron routes require `Authorization: Bearer <CRON_SECRET>` header.

---

## Email behaviors (triggered by events)

| Event                                  | Email sent                                                                          |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| Review with rating ≤ threshold arrives | Negative review alert to owner (with suggested reply)                               |
| Monday each week                       | Weekly digest: review summary, sentiment insights, AI action items, staff shoutouts |
| User uploads CSV + clicks Send All     | Review request email to each customer with tracking link                            |

---

## Plan gates — must stay enforced

| Feature                      | Starter | Growth | Agency |
| ---------------------------- | ------- | ------ | ------ |
| AI reply drafts (3 variants) | ✓       | ✓      | ✓      |
| Urgent review alerts         | ✓       | ✓      | ✓      |
| Weekly digest                | ✓       | ✓      | ✓      |
| Review request campaigns     | ✓       | ✓      | ✓      |
| Reputation score             | ✗       | ✓      | ✓      |
| Sentiment analysis           | ✗       | ✓      | ✓      |
| Competitor tracking          | ✗       | ✓      | ✓      |
| Monthly PDF report           | ✗       | ✓      | ✓      |
| Custom reply persona         | ✗       | ✗      | ✓      |
| White-label PDF reports      | ✗       | ✗      | ✓      |
| Locations                    | 1       | 5      | 15     |
| Competitor slots / location  | 3       | 5      | 10     |

Source of truth: `lib/planLimits.ts`. Settings page must show locked UI with "Upgrade" link for gated features.

---

## Auth invariants — must not regress

- Magic link sign-in only (no password auth)
- `POST /api/auth/magic-link` must check `accounts` table before sending OTP — unknown emails return 404
- `shouldCreateUser: false` must be set on all `signInWithOtp` calls
- Sign-in page must route through `/api/auth/magic-link`, never call Supabase directly
- Google OAuth is GMB integration only — not used for user authentication
- All server routes authenticate via Supabase session (`createClient` from `@/utils/supabase/server`)
- Service role key used for all admin DB reads; access control enforced by checking `user.email` at route level
