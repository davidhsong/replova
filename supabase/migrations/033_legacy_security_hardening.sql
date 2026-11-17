-- Forward-only hardening for legacy objects created before the audited
-- function set in migration 032. This migration changes ACLs, RLS state,
-- function configuration, and one intended NOT NULL invariant only. It never
-- rewrites or deletes application rows and does not change default privileges.

DO $migration_preflight$
DECLARE
  missing_objects text;
BEGIN
  SELECT string_agg(required.object_name, ', ' ORDER BY required.object_name)
  INTO missing_objects
  FROM (
    VALUES
      ('function public.claim_due_replies(integer)', pg_catalog.to_regprocedure('public.claim_due_replies(integer)') IS NOT NULL),
      ('function public.increment_api_spend(double precision)', pg_catalog.to_regprocedure('public.increment_api_spend(double precision)') IS NOT NULL),
      ('function public.owns_restaurant(uuid)', pg_catalog.to_regprocedure('public.owns_restaurant(uuid)') IS NOT NULL),
      ('function public.set_replova_knowledge_updated_at()', pg_catalog.to_regprocedure('public.set_replova_knowledge_updated_at()') IS NOT NULL),
      ('function public.set_replova_workspace_updated_at()', pg_catalog.to_regprocedure('public.set_replova_workspace_updated_at()') IS NOT NULL),
      ('function public.set_youtube_automation_updated_at()', pg_catalog.to_regprocedure('public.set_youtube_automation_updated_at()') IS NOT NULL),
      ('function public.valid_youtube_category_rules(jsonb)', pg_catalog.to_regprocedure('public.valid_youtube_category_rules(jsonb)') IS NOT NULL),
      ('function public.valid_youtube_video_filter(text,text[])', pg_catalog.to_regprocedure('public.valid_youtube_video_filter(text,text[])') IS NOT NULL),
      ('function public.youtube_auto_publish_scope_hash(jsonb,integer,numeric,integer,integer,text,text[])', pg_catalog.to_regprocedure('public.youtube_auto_publish_scope_hash(jsonb,integer,numeric,integer,integer,text,text[])') IS NOT NULL),
      ('table public.api_budget_state', pg_catalog.to_regclass('public.api_budget_state') IS NOT NULL),
      ('table public.api_usage_log', pg_catalog.to_regclass('public.api_usage_log') IS NOT NULL),
      ('table public.review_requests', pg_catalog.to_regclass('public.review_requests') IS NOT NULL)
  ) AS required(object_name, object_exists)
  WHERE NOT required.object_exists;

  IF missing_objects IS NOT NULL THEN
    RAISE EXCEPTION 'migration_033_missing_required_objects: %', missing_objects;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'review_requests'
      AND column_name = 'customer_email'
  ) THEN
    RAISE EXCEPTION 'migration_033_missing_review_requests_customer_email';
  END IF;
END;
$migration_preflight$;

-- Migration 003 intended this column to be required, but migration 001 had
-- already created the table with a nullable column, so CREATE TABLE IF NOT
-- EXISTS in 003 could not enforce the declaration. Current upload and send
-- paths require an email. Fail closed if historical rows violate that contract;
-- operators must review and repair those rows explicitly before retrying.
DO $review_request_integrity$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.review_requests
    WHERE customer_email IS NULL
  ) THEN
    RAISE EXCEPTION
      'migration_033_review_requests_customer_email_nulls_require_manual_remediation';
  END IF;
END;
$review_request_integrity$;

ALTER TABLE public.review_requests
  ALTER COLUMN customer_email SET NOT NULL;

-- The reply processor is called only by the cron/background worker through
-- the service-role client. Client execution would bypass tenant RLS because
-- the function is SECURITY DEFINER and returns claimed queue rows.
ALTER FUNCTION public.claim_due_replies(integer)
  SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL ON FUNCTION public.claim_due_replies(integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_due_replies(integer) TO service_role;

-- Authenticated execution is required because the restaurant-scoped RLS
-- policies created by migration 001 invoke this ownership predicate. Anonymous
-- users have no legitimate ownership context. Keep service-role compatibility
-- for server-side diagnostics while pinning trusted schemas before pg_temp.
ALTER FUNCTION public.owns_restaurant(uuid)
  SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL ON FUNCTION public.owns_restaurant(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_restaurant(uuid)
  TO authenticated, service_role;

-- API usage and budget state are global server-side operational data rather
-- than tenant-readable product data. No browser/session role reads or mutates
-- these tables; all active callers use the service-role client or a separately
-- hardened SECURITY DEFINER server RPC.
ALTER TABLE public.api_budget_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.api_budget_state
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.api_usage_log
  FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.api_budget_state TO service_role;
GRANT ALL ON TABLE public.api_usage_log TO service_role;

ALTER FUNCTION public.increment_api_spend(double precision)
  SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL ON FUNCTION public.increment_api_spend(double precision)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_api_spend(double precision)
  TO service_role;

-- Trigger helpers and pure YouTube policy validators are not privileged, but
-- Supabase's defaults still expose them as browser RPCs. They have no direct
-- client caller. Keep the trigger/constraint and server-function execution
-- surface explicit, and pin catalog resolution for defense in depth.
ALTER FUNCTION public.set_replova_knowledge_updated_at()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.set_replova_workspace_updated_at()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.set_youtube_automation_updated_at()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.valid_youtube_category_rules(jsonb)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.valid_youtube_video_filter(text, text[])
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.youtube_auto_publish_scope_hash(
  jsonb, integer, numeric, integer, integer, text, text[]
)
  SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.set_replova_knowledge_updated_at()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_replova_workspace_updated_at()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_youtube_automation_updated_at()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.valid_youtube_category_rules(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.valid_youtube_video_filter(text, text[])
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.youtube_auto_publish_scope_hash(
  jsonb, integer, numeric, integer, integer, text, text[]
)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.set_replova_knowledge_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_replova_workspace_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_youtube_automation_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.valid_youtube_category_rules(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.valid_youtube_video_filter(text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.youtube_auto_publish_scope_hash(
  jsonb, integer, numeric, integer, integer, text, text[]
) TO service_role;

-- Supabase's public-schema defaults grant non-DML table capabilities to API
-- roles. Replova has no client path that performs maintenance, defines foreign
-- keys or triggers, or truncates tables. Remove those capabilities from the
-- complete application schema without changing project-wide defaults or the
-- existing RLS-governed SELECT/INSERT/UPDATE/DELETE contract.
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON ALL TABLES IN SCHEMA public
  FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.review_requests.customer_email IS
  'Required destination address validated and normalized by the review-request upload route.';
COMMENT ON TABLE public.api_budget_state IS
  'Server-only global OpenAI budget state. Client roles have no table privileges or RLS policies.';
COMMENT ON TABLE public.api_usage_log IS
  'Server-only OpenAI usage and rate-limit ledger. Client roles have no table privileges or RLS policies.';
