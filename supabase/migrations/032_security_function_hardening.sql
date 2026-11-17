-- Forward-only hardening for privileged functions introduced by migrations
-- 017-030. Migration 031 must be present first so the complete application
-- schema is validated before these grants are reconciled.
--
-- This migration deliberately changes only function configuration and ACLs.
-- It does not replace function bodies, change owners, or touch application data.
-- Supabase's migration runner supplies the transaction boundary.

DO $migration_preflight$
DECLARE
  missing_signatures text;
BEGIN
  SELECT string_agg(signature, ', ' ORDER BY signature)
  INTO missing_signatures
  FROM unnest(ARRAY[
    'public.checkpoint_youtube_automation_sync(uuid,uuid,uuid,text,timestamptz,boolean)',
    'public.claim_youtube_automation_connections(integer,text,integer,uuid)',
    'public.claim_youtube_draft_items(integer,text,integer,uuid,boolean)',
    'public.claim_youtube_manual_publish(uuid,uuid,timestamptz,uuid,text)',
    'public.claim_youtube_publish_items(integer,text,integer)',
    'public.consume_google_business_oauth_state(text,uuid)',
    'public.current_user_owns_replova_account(uuid)',
    'public.current_user_owns_replova_workspace(uuid)',
    'public.delete_youtube_knowledge_base_on_disconnect()',
    'public.disconnect_google_business_workspace(uuid,uuid)',
    'public.fail_youtube_manual_publish(uuid,uuid,uuid,uuid,text,boolean,text,text)',
    'public.fail_youtube_reply_regeneration(uuid,uuid,uuid,uuid,text)',
    'public.finish_youtube_automation_connection(uuid,uuid,uuid,boolean,text)',
    'public.finish_youtube_manual_publish(uuid,uuid,uuid,uuid,text,text,text,timestamptz,boolean)',
    'public.finish_youtube_reply_regeneration(uuid,uuid,uuid,uuid,text,text,numeric,boolean)',
    'public.finish_youtube_reply_regeneration_with_context(uuid,uuid,uuid,uuid,text,text,numeric,boolean,boolean,text,uuid[])',
    'public.grant_youtube_auto_publish_consent(uuid,uuid,text)',
    'public.invalidate_youtube_auto_publish_consent_on_scope_change()',
    'public.link_google_business_locations(uuid,uuid,uuid,text,jsonb,boolean)',
    'public.owns_youtube_connection(uuid)',
    'public.preview_phase6a_workspace_backfill()',
    'public.provision_replova_account_workspace(uuid,text,text,text)',
    'public.replace_youtube_playlist_memberships(uuid,text,jsonb,boolean,timestamptz)',
    'public.revoke_youtube_auto_publish_consent(uuid,uuid)',
    'public.run_phase6a_workspace_backfill(text)',
    'public.set_youtube_automation_emergency_pause(uuid,uuid,boolean)',
    'public.transition_youtube_reply_queue_item(uuid,uuid,timestamptz,text,text,uuid)',
    'public.update_youtube_auto_publish_policy(uuid,uuid,timestamptz,jsonb,integer,numeric,integer,integer,text,text[])',
    'public.validate_replova_account_auth_user()',
    'public.validate_replova_knowledge_base_owner()',
    'public.validate_replova_knowledge_entry_owner()',
    'public.validate_replova_restaurant_workspace_owner()',
    'public.validate_youtube_auto_publish_consent()'
  ]::text[]) AS required(signature)
  WHERE pg_catalog.to_regprocedure(signature) IS NULL;

  IF missing_signatures IS NOT NULL THEN
    RAISE EXCEPTION 'migration_032_missing_required_functions: %', missing_signatures;
  END IF;

  IF pg_catalog.to_regprocedure(
    'public.playbook_apply_proposal(uuid,uuid,integer,integer,uuid,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'migration_032_requires_migration_031';
  END IF;
END;
$migration_preflight$;

-- Supabase recommends an empty search_path plus fully-qualified references for
-- SECURITY DEFINER functions. These established functions contain extensive
-- unqualified references, so replacing all 33 bodies in a privilege-only
-- migration would create avoidable behavior drift. Pin pg_catalog first,
-- trusted application schemas next, and pg_temp last. A later body rewrite can
-- move them to an empty path after PostgreSQL staging equivalence tests.

ALTER FUNCTION public.checkpoint_youtube_automation_sync(uuid, uuid, uuid, text, timestamptz, boolean)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.claim_youtube_automation_connections(integer, text, integer, uuid)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.claim_youtube_draft_items(integer, text, integer, uuid, boolean)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.claim_youtube_manual_publish(uuid, uuid, timestamptz, uuid, text)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.claim_youtube_publish_items(integer, text, integer)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.consume_google_business_oauth_state(text, uuid)
  SET search_path = pg_catalog, public, auth, pg_temp;
ALTER FUNCTION public.current_user_owns_replova_account(uuid)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.current_user_owns_replova_workspace(uuid)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.delete_youtube_knowledge_base_on_disconnect()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.disconnect_google_business_workspace(uuid, uuid)
  SET search_path = pg_catalog, public, auth, pg_temp;
ALTER FUNCTION public.fail_youtube_manual_publish(uuid, uuid, uuid, uuid, text, boolean, text, text)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.fail_youtube_reply_regeneration(uuid, uuid, uuid, uuid, text)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.finish_youtube_automation_connection(uuid, uuid, uuid, boolean, text)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.finish_youtube_manual_publish(uuid, uuid, uuid, uuid, text, text, text, timestamptz, boolean)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.finish_youtube_reply_regeneration(uuid, uuid, uuid, uuid, text, text, numeric, boolean)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.finish_youtube_reply_regeneration_with_context(uuid, uuid, uuid, uuid, text, text, numeric, boolean, boolean, text, uuid[])
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.grant_youtube_auto_publish_consent(uuid, uuid, text)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.invalidate_youtube_auto_publish_consent_on_scope_change()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.link_google_business_locations(uuid, uuid, uuid, text, jsonb, boolean)
  SET search_path = pg_catalog, public, auth, pg_temp;
ALTER FUNCTION public.owns_youtube_connection(uuid)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.preview_phase6a_workspace_backfill()
  SET search_path = pg_catalog, public, auth, pg_temp;
ALTER FUNCTION public.provision_replova_account_workspace(uuid, text, text, text)
  SET search_path = pg_catalog, public, auth, pg_temp;
ALTER FUNCTION public.replace_youtube_playlist_memberships(uuid, text, jsonb, boolean, timestamptz)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.revoke_youtube_auto_publish_consent(uuid, uuid)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.run_phase6a_workspace_backfill(text)
  SET search_path = pg_catalog, public, auth, pg_temp;
ALTER FUNCTION public.set_youtube_automation_emergency_pause(uuid, uuid, boolean)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.transition_youtube_reply_queue_item(uuid, uuid, timestamptz, text, text, uuid)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.update_youtube_auto_publish_policy(uuid, uuid, timestamptz, jsonb, integer, numeric, integer, integer, text, text[])
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.validate_replova_account_auth_user()
  SET search_path = pg_catalog, public, auth, pg_temp;
ALTER FUNCTION public.validate_replova_knowledge_base_owner()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.validate_replova_knowledge_entry_owner()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.validate_replova_restaurant_workspace_owner()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.validate_youtube_auto_publish_consent()
  SET search_path = pg_catalog, public, pg_temp;

-- Clear PostgreSQL's PUBLIC default and Supabase's explicit API-role defaults
-- from every audited privileged function. Exact grants are restored below.
REVOKE ALL ON FUNCTION public.checkpoint_youtube_automation_sync(uuid, uuid, uuid, text, timestamptz, boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_youtube_automation_connections(integer, text, integer, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_youtube_draft_items(integer, text, integer, uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_youtube_manual_publish(uuid, uuid, timestamptz, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_youtube_publish_items(integer, text, integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.consume_google_business_oauth_state(text, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.current_user_owns_replova_account(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.current_user_owns_replova_workspace(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.delete_youtube_knowledge_base_on_disconnect() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.disconnect_google_business_workspace(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fail_youtube_manual_publish(uuid, uuid, uuid, uuid, text, boolean, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fail_youtube_reply_regeneration(uuid, uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.finish_youtube_automation_connection(uuid, uuid, uuid, boolean, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.finish_youtube_manual_publish(uuid, uuid, uuid, uuid, text, text, text, timestamptz, boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.finish_youtube_reply_regeneration(uuid, uuid, uuid, uuid, text, text, numeric, boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.finish_youtube_reply_regeneration_with_context(uuid, uuid, uuid, uuid, text, text, numeric, boolean, boolean, text, uuid[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.grant_youtube_auto_publish_consent(uuid, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.invalidate_youtube_auto_publish_consent_on_scope_change() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.link_google_business_locations(uuid, uuid, uuid, text, jsonb, boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.owns_youtube_connection(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.preview_phase6a_workspace_backfill() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.provision_replova_account_workspace(uuid, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.replace_youtube_playlist_memberships(uuid, text, jsonb, boolean, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.revoke_youtube_auto_publish_consent(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.run_phase6a_workspace_backfill(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_youtube_automation_emergency_pause(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.transition_youtube_reply_queue_item(uuid, uuid, timestamptz, text, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.update_youtube_auto_publish_policy(uuid, uuid, timestamptz, jsonb, integer, numeric, integer, integer, text, text[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.validate_replova_account_auth_user() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.validate_replova_knowledge_base_owner() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.validate_replova_knowledge_entry_owner() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.validate_replova_restaurant_workspace_owner() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.validate_youtube_auto_publish_consent() FROM PUBLIC, anon, authenticated, service_role;

-- RLS policies invoke only these three ownership predicates as authenticated.
GRANT EXECUTE ON FUNCTION public.current_user_owns_replova_account(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_owns_replova_workspace(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_youtube_connection(uuid) TO authenticated, service_role;

-- Server routes, background workers, and triggers use the remaining enabled
-- privileged functions through the service-role client.
GRANT EXECUTE ON FUNCTION public.checkpoint_youtube_automation_sync(uuid, uuid, uuid, text, timestamptz, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_youtube_automation_connections(integer, text, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_youtube_draft_items(integer, text, integer, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_youtube_manual_publish(uuid, uuid, timestamptz, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_google_business_oauth_state(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_youtube_knowledge_base_on_disconnect() TO service_role;
GRANT EXECUTE ON FUNCTION public.disconnect_google_business_workspace(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_youtube_manual_publish(uuid, uuid, uuid, uuid, text, boolean, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_youtube_reply_regeneration(uuid, uuid, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_youtube_automation_connection(uuid, uuid, uuid, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_youtube_manual_publish(uuid, uuid, uuid, uuid, text, text, text, timestamptz, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_youtube_reply_regeneration(uuid, uuid, uuid, uuid, text, text, numeric, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_youtube_reply_regeneration_with_context(uuid, uuid, uuid, uuid, text, text, numeric, boolean, boolean, text, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_youtube_auto_publish_consent(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.invalidate_youtube_auto_publish_consent_on_scope_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.link_google_business_locations(uuid, uuid, uuid, text, jsonb, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.preview_phase6a_workspace_backfill() TO service_role;
GRANT EXECUTE ON FUNCTION public.provision_replova_account_workspace(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.replace_youtube_playlist_memberships(uuid, text, jsonb, boolean, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_youtube_auto_publish_consent(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_phase6a_workspace_backfill(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_youtube_automation_emergency_pause(uuid, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_youtube_reply_queue_item(uuid, uuid, timestamptz, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_youtube_auto_publish_policy(uuid, uuid, timestamptz, jsonb, integer, numeric, integer, integer, text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_replova_account_auth_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_replova_knowledge_base_owner() TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_replova_knowledge_entry_owner() TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_replova_restaurant_workspace_owner() TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_youtube_auto_publish_consent() TO service_role;

-- Intentionally no grant for claim_youtube_publish_items(integer,text,integer).
-- Migration 025 disabled unattended publishing by revoking service_role; this
-- hardening migration preserves that product safety boundary.
