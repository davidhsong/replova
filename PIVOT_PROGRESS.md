# Replova → Med Spa Pivot Progress

## Completed
- [x] PROMPT 1: Core AI Logic
  - lib/sentiment.ts — updated system prompt, renamed menuMentions → treatmentMentions, preserved menu_mentions DB column mapping
  - lib/sendDigest.ts — updated advisor prompt, fixed business name fallback, cleaned subject line
  - lib/discoverCompetitors.ts — updated to business-agnostic language, cuisineType → businessType parameter
  - app/api/competitors/auto-discover/route.ts — updated cuisineType → businessType call site
- [x] PROMPT 2: Settings UI (business type selector replacing cuisine dropdown)
  - cuisineType/setCuisineType → businessType/setBusinessType; cuisineResult/setCuisineResult → businessTypeResult/setBusinessTypeResult
  - Restaurant Profile section replaced with Business Profile section + 10 med spa/service business type options
  - Persona placeholder updated to practice-focused language
  - Delete account copy updated (restaurant → account)
  - cuisine_type DB column still used for persistence — no migration needed
  - TypeScript check passed clean

## Remaining
- [x] PROMPT 3: Onboarding + Dashboard Copy
  - app/onboard/page.tsx — step label, heading, subheading, placeholders, success text all updated to business/practice language
  - components/dashboard/IntelligencePanel.tsx — competitor link text and staff shoutouts label updated
  - app/dashboard/Chatbot.tsx — business name intent expanded with practice terms, response text updated, auto-discover text updated, CHIPS label updated
  - app/dashboard/DemoMode.tsx — demo-1 updated to med-spa scenario (Sarah M., Botox consultation, all 3 reply drafts updated)
  - app/dashboard/competitors/page.tsx — bonus fix: "nearby restaurants" → "nearby competitors" caught by verification grep
  - TypeScript check passed clean
- [x] PROMPT 4: Public Pages
  - app/page.tsx — eyebrow/h1 updated (menu/meal → proof/visit), trust strip updated (restaurant names → med spa names, "In the kitchens of" → "Trusted by"), body copy updated ("owner-operators between covers" → "practice owners between appointments"), product shot demo copy updated (food reviews → facial/HydraFacial reviews + service-based negative review), pricing updated ($39/$99/$199 → $79/$179/$349), "best for" updated (Single-site GMs/Small chains → Solo practices/Multi-location studios), CTA updated ("lunch rush" → "first appointment", $39 → $79), CTA button "Find my restaurant" → "Find my business"
  - app/terms/page.tsx — service description updated (restaurant → local service businesses incl. med spas/salons/dental), pricing updated ($39/$99/$199 → $79/$179/$349), "restaurant details" → "business details", "restaurants, reviews" → "businesses, reviews"
  - app/privacy/page.tsx — "restaurant name" → "business name"
  - Verification grep returned zero results; TypeScript check passed clean
  - ⚠️  PRICING CONSTANTS STILL NEED UPDATING: Stripe price IDs and any server-side plan pricing constants (lib/planLimits.ts or similar) are NOT updated — those need a separate pass to match $79/$179/$349
- [x] PROMPT 5: Competitor Discovery API + CLAUDE.md
  Files changed: app/api/competitors/auto-discover/route.ts, lib/places.ts, CLAUDE.md
  - auto-discover/route.ts — added getGooglePlacesType() mapping function; updated findNearbyCompetitors() call to pass mapped Places type (e.g. medical_spa → 'spa') as keyword instead of raw cuisine_type; fixed user-visible error message "Restaurant has no Google Place ID" → "Business has no Google Place ID"; updated comment removing "cuisine" language
  - lib/places.ts — searchNearbyPlaces: type 'restaurant' → 'establishment'; findNearbyCompetitors inner nearbySearch: type 'restaurant' → 'establishment', radius 2000 → 8000 (8km for med spa draw area)
  - CLAUDE.md — updated top-level description; auto-discover route note; settings/reports Agency → Practice; lib/sentiment.ts description updated for treatment mentions; lib/pdfReport.tsx Agency → Practice; restaurants table: added cuisine_type business type note; reviews table: noted menu_mentions stores treatment/service mentions; accounts table: plan values solo/studio/practice; Plans & Pricing table: Solo $79/Studio $179/Practice $349; billing checkout plan param updated; inTrial note updated
  - lib/places.ts grep hits reviewed: 'restaurant' in GENERIC_PLACE_TYPES set (correct — it's a filter value, not a search param); restaurantTypes variable (runtime data from Google, not hardcoded)
  - TypeScript check passed clean
  - ⚠️  Stripe env var names (STRIPE_PRICE_ID_STARTER/GROWTH/AGENCY) left as-is in CLAUDE.md — these are actual code-level env var names; renaming requires a separate pass through billing code and .env.local
- [x] PROMPT 6: New Feature — Provider Reputation Dashboard
  Files created: app/api/providers/stats/route.ts, components/dashboard/ProviderCard.tsx, components/dashboard/ProviderDashboard.tsx, lib/providerStats.ts
  Files modified: app/dashboard/page.tsx
  - lib/providerStats.ts — ProviderStats interface shared between API route and frontend
  - app/api/providers/stats/route.ts — authenticated GET route; verifies restaurant ownership, queries reviews with staff_mentions, aggregates per-provider stats (totalMentions, positiveMentions, negativeMentions, avgRating, recentMentions, sentimentScore), sorts by totalMentions desc
  - components/dashboard/ProviderCard.tsx — card showing name, rank badge, mention count, avg rating, sentiment bar (green/red/gray), recent badge, negative warning
  - components/dashboard/ProviderDashboard.tsx — client component; fetches on mount, skeleton loading state, empty state, 2-column card grid; gated on plan === 'starter' with UpgradeLock (Studio and above)
  - app/dashboard/page.tsx — imported ProviderDashboard, rendered below the two-column review/sidebar layout
  - TypeScript check passed clean

---

## PIVOT COMPLETE — 2026-05-15

All 6 prompts complete. The Replova platform has been fully pivoted from restaurant reputation management to a med spa and local service business platform:
- Core AI logic updated for treatments, services, and aesthetic business context
- Settings UI updated with business type selector (10 med spa / service business options)
- Onboarding and dashboard copy updated throughout
- Public pages (homepage, terms, privacy) updated with new positioning and pricing ($79/$179/$349)
- Competitor discovery updated for med spa draw areas and place types
- New Provider Reputation Dashboard feature built from scratch

## Notes
- TypeScript check passed clean (npx tsc --noEmit) after all changes
- DB column menu_mentions is preserved as-is; SentimentResult.treatmentMentions maps to it in analyzeAndSaveReview
- cuisine_type DB column still used in auto-discover route (passed as businessType param) — no DB migration needed
