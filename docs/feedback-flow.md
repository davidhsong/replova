# Feedback flow

The Feedback page calls the read-only, service-role-only `tap_flow_period` RPC after resolving the owner's active location. The chart, category ranking and requested inbox page share one PostgreSQL statement and the existing `tap_visits` local-date, source, rating and test-mode filters. A selected theme or bookmarked entry narrows the chart along with the inbox. Selecting a branch narrows only the paginated inbox.

Whitespace-only comments end at Rating only. A working analysis or eligible queued analysis goes to Analysis pending. Failed analysis and unscheduled comments go to Analysis unavailable. On an analyzed comment, either an urgent flag or at least one effective issue theme establishes an issue. An urgent flag still counts after an owner removes all themes. Every visit belongs to exactly one terminal branch. The category ranking independently counts each distinct visit once per category.

The Preview demo uses the same server component and reads one fixed synthetic location on replova-staging. The demo path accepts ordinary date, placard, rating, theme and mode filters. Owner mutations are available in the authenticated dashboard. The demo route returns 404 outside the Preview environment or when configured with a different database.

The canonical artwork is `public/brand/mark.png`, cropped from the supplied 500 × 500 PNG to the 278 × 278 connected mark (the outer transparent margin contains isolated alpha-1 pixels). Lockups retain the existing vector wordmark. Dark icons use the same alpha silhouette. The customer form, receipt and standalone printable use the shared light lockup. The printable's footer sits outside the QR's full four-module quiet zone. The approved film and poster show the same arrow already printed on the illustrated placard.

Run `npm test` and `npm run verify`. The existing isolated PostgreSQL and browser harness supports `node tests/local/pilot.local.mjs --flow` and `--evidence-volume`. Set `FLOW_ARTIFACTS` to capture rendered logos, layouts and the phone recording.
