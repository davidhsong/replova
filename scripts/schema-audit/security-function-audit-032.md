# Migration 032 privileged-function audit

This is the sanitized design record for `032_security_function_hardening.sql`.
The live catalog was inspected with catalog-only `SELECT` statements. No
application rows, credentials, OAuth tokens, or customer data were queried.

## Catalog baseline

- All 33 audited functions are in `public`, are `SECURITY DEFINER`, and are
  owned by `postgres` in the connected Supabase project.
- Before 032: 29 were executable by both `anon` and `authenticated`; 32 were
  executable by `service_role`; all 33 were executable by their owner. The
  intentionally disabled `claim_youtube_publish_items(integer,text,integer)`
  was the only function without a `service_role` grant.
- Before 032: 26 used `search_path=public` and seven used
  `search_path=public, auth`.
- The connected project's `public` schema grants `CREATE` only to
  `pg_database_owner`. `PUBLIC`, `anon`, and `authenticated` have `USAGE`, not
  `CREATE`.

## Function-by-function decision

`Owner` is `postgres` for every row. `Before` lists API-role grants; owner
execution is implicit. Every function still requires definer rights because it
either implements an RLS predicate, bypasses RLS for a server transaction, or
is a constraint trigger that must validate independently of the caller.

| Exact signature | Before | After | Caller and compatibility decision |
| --- | --- | --- | --- |
| `checkpoint_youtube_automation_sync(uuid,uuid,uuid,text,timestamptz,boolean)` | anon, authenticated, service | service | YouTube automation worker; server-only lease checkpoint. |
| `claim_youtube_automation_connections(integer,text,integer,uuid)` | anon, authenticated, service | service | YouTube automation worker; server-only atomic claim. |
| `claim_youtube_draft_items(integer,text,integer,uuid,boolean)` | anon, authenticated, service | service | Draft worker and generate-pending server route. |
| `claim_youtube_manual_publish(uuid,uuid,timestamptz,uuid,text)` | anon, authenticated, service | service | Manual-publish server route; client execution would bypass queue controls. |
| `claim_youtube_publish_items(integer,text,integer)` | anon, authenticated | none | No active caller. Migration 025 intentionally disabled unattended publishing, including service-role execution. |
| `consume_google_business_oauth_state(text,uuid)` | service | service | Google OAuth callback transaction; already correctly restricted. |
| `current_user_owns_replova_account(uuid)` | anon, authenticated, service | authenticated, service | Required by account/workspace RLS; anonymous execution is unnecessary. |
| `current_user_owns_replova_workspace(uuid)` | anon, authenticated, service | authenticated, service | Required by workspace, Google, and Playbook RLS policies. |
| `delete_youtube_knowledge_base_on_disconnect()` | anon, authenticated, service | service | Trigger on YouTube disconnection; no direct client caller. |
| `disconnect_google_business_workspace(uuid,uuid)` | service | service | Server-only Google disconnect transaction; already correctly restricted. |
| `fail_youtube_manual_publish(uuid,uuid,uuid,uuid,text,boolean,text,text)` | anon, authenticated, service | service | Manual-publish error path in a server route. |
| `fail_youtube_reply_regeneration(uuid,uuid,uuid,uuid,text)` | anon, authenticated, service | service | Reply-regeneration server error path. |
| `finish_youtube_automation_connection(uuid,uuid,uuid,boolean,text)` | anon, authenticated, service | service | YouTube automation worker completion. |
| `finish_youtube_manual_publish(uuid,uuid,uuid,uuid,text,text,text,timestamptz,boolean)` | anon, authenticated, service | service | Manual-publish server completion. |
| `finish_youtube_reply_regeneration(uuid,uuid,uuid,uuid,text,text,numeric,boolean)` | anon, authenticated, service | service | Compatibility wrapper used by the context-aware completion function. |
| `finish_youtube_reply_regeneration_with_context(uuid,uuid,uuid,uuid,text,text,numeric,boolean,boolean,text,uuid[])` | anon, authenticated, service | service | Context-aware reply server route. |
| `grant_youtube_auto_publish_consent(uuid,uuid,text)` | anon, authenticated, service | service | Authenticated route verifies the user, then calls through its admin client. |
| `invalidate_youtube_auto_publish_consent_on_scope_change()` | anon, authenticated, service | service | Trigger on policy changes; no direct client caller. |
| `link_google_business_locations(uuid,uuid,uuid,text,jsonb,boolean)` | service | service | Server-only Google callback/link transaction; already correctly restricted. |
| `owns_youtube_connection(uuid)` | anon, authenticated, service | authenticated, service | Required by YouTube settings, queue, log, and usage RLS policies. |
| `preview_phase6a_workspace_backfill()` | anon, authenticated, service | service | Manual server/operator preview; not an end-user RPC. |
| `provision_replova_account_workspace(uuid,text,text,text)` | service | service | Account-first onboarding server route; already correctly restricted. |
| `replace_youtube_playlist_memberships(uuid,text,jsonb,boolean,timestamptz)` | anon, authenticated, service | service | YouTube Studio persistence service. |
| `revoke_youtube_auto_publish_consent(uuid,uuid)` | anon, authenticated, service | service | Authenticated route verifies the user, then calls through its admin client. |
| `run_phase6a_workspace_backfill(text)` | anon, authenticated, service | service | Explicit operator-only backfill; it calls the preview internally. |
| `set_youtube_automation_emergency_pause(uuid,uuid,boolean)` | anon, authenticated, service | service | Authenticated route verifies the owner, then calls through its admin client. |
| `transition_youtube_reply_queue_item(uuid,uuid,timestamptz,text,text,uuid)` | anon, authenticated, service | service | Reply-queue server routes; server-side ownership and concurrency checks precede the RPC. |
| `update_youtube_auto_publish_policy(uuid,uuid,timestamptz,jsonb,integer,numeric,integer,integer,text,text[])` | anon, authenticated, service | service | Authenticated route verifies the owner, then calls through its admin client. |
| `validate_replova_account_auth_user()` | anon, authenticated, service | service | Account integrity trigger; no direct client caller. |
| `validate_replova_knowledge_base_owner()` | anon, authenticated, service | service | Knowledge-base integrity trigger. |
| `validate_replova_knowledge_entry_owner()` | anon, authenticated, service | service | Knowledge-entry integrity trigger. |
| `validate_replova_restaurant_workspace_owner()` | anon, authenticated, service | service | Restaurant/workspace integrity trigger. |
| `validate_youtube_auto_publish_consent()` | anon, authenticated, service | service | YouTube settings integrity trigger. |

## Search-path decision

Supabase's preferred end state is `search_path=''` with every referenced
relation and function schema-qualified. The 33 established bodies contain many
unqualified relations, row types, and internal function calls. Replacing those
bodies inside an ACL-only migration would introduce unnecessary behavioral
risk. Migration 032 therefore applies the narrower, behavior-preserving
hardening:

- `pg_catalog` is first, preventing application-schema objects from shadowing
  built-ins.
- `public` and, only where previously present, `auth` remain explicit trusted
  schemas so existing bodies resolve identically.
- `pg_temp` is explicit and last, preventing temporary relations from taking
  precedence.

Moving to an empty path remains a separate refactor requiring schema-qualified
body replacements plus PostgreSQL staging equivalence tests. Migration 032 does
not claim that refactor is complete.

## Unchanged surfaces and follow-up

- Migration 031 Playbook definer functions already use
  `pg_catalog, pg_temp`, fully qualify application relations, and grant only
  `service_role`; 032 checks that 031 exists and does not rewrite them.
- No billing/Stripe functions are in the affected set.
- `claim_due_replies(integer)` is an older, pre-017 definer function with a
  public-first path. It was outside Step 20's 017-031 audit scope and is not
  silently changed by 032. Migration 033 completes that dedicated review,
  restricts execution to `service_role`, and pins its search path.
- Default function privileges are project-wide configuration and are not
  changed by 032 or 033. Migration 033 instead applies explicit least-privilege
  ACLs to the reviewed legacy objects so it does not risk breaking unrelated
  or future migration behavior.
