# Tap issue ranking and evidence Playbooks

The starting production deployment was `dpl_DWBdmYF6JFQjNdb7k2AoUgAgVYuf` in Vercel project `replova`. Its 491 uploaded source files matched the Git archive of `4f0b3b6daac57c16621bc799696ea05b061c3ba0`. The linked production database reported migration 037 and both existing pilot schedules.

Migration 038 adds a category catalog, evidence and scheduling fields on existing issue Playbooks, and service-role RPCs. Historical analysis, owner corrections and saved snapshots stay in place. Category ranking resolves the current stored themes at read time. Preview visits use their own evidence and denominator. An unknown historical theme retains its name under Other. Future feedback can also carry a classifier category and exact quotes describing incident context.

One consolidated issue plan is saved per location, category, quarter and feedback mode. The first creation records its filters and freezes the supporting visits. Previously saved theme and quarterly plans remain available under Related saved Playbooks. New matching visits and later analysis or theme corrections can supply additional evidence. Adding evidence leaves the original snapshot and owner notes intact.

The service simulator uses a separate due column, durable quote terms and a stable simulated appointment reference. Each revision and its activity entry commit together. A creation response can finish before the simulator. The minute worker resumes from the last saved stage. The legacy transition rejects these plans, and the legacy queue cannot schedule them. Staff and safety plans create ordinary workspace tasks. Only the owner can confirm real improvement after the evidence threshold is met.

## Rehearsal

Run `npm test`, `npm run verify` and `npm run test:pilot:browser`. Use the existing loopback PostgreSQL, PostgREST and Chromium setup described in [pilot.md](pilot.md).

- `node tests/local/pilot.local.mjs --evidence` exercises the owner flow, alias counts, original and added evidence, worker recovery, duplicate actions and tenant isolation. Set `TAP_EVIDENCE_VIDEO` to an absolute WebM destination to retain the phone recording. The harness records model calls and rejects external TCP connections.
- `node tests/local/pilot.local.mjs --evidence-volume` measures ranking, drill-down and evidence lookup on the existing 20-business, 60-location, 100,000-visit fixture.

## Release and rollback

Deploy the release Git archive with the existing Production configuration. Apply migration 038 before directing traffic to the new application. The prior application can continue collecting feedback and processing authorized analysis during the migration. No configuration, scheduler or claim allowance changes are required.

To roll the application back, run this command against the linked Vercel production project.

```powershell
vercel rollback https://replova-8zolpmeqq-davidhsongg-7397s-projects.vercel.app --yes
```

Verify that `vercel inspect www.replova.app` returns the previous deployment ID above. Retain migration 038, all Playbooks and their activity. The old application continues using its original period and quarter RPCs. Pending simulations stay isolated until the new application returns. Check the public sign-in page, protected owner link, production scope balance and scheduler definitions using read-only requests.
