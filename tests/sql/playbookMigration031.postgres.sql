\set ON_ERROR_STOP on

-- Real PostgreSQL regression harness for migration 031. Run against a fresh,
-- disposable PostgreSQL 15+ database only.
DO $$
BEGIN
  IF current_setting('server_version_num')::integer < 150000 THEN
    RAISE EXCEPTION 'Migration 031 requires PostgreSQL 15 or newer';
  END IF;
END $$;

CREATE EXTENSION dblink;
CREATE SCHEMA auth;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text,
  email_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text UNIQUE NOT NULL,
  auth_user_id uuid REFERENCES auth.users(id),
  plan text NOT NULL DEFAULT 'growth',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.business_workspaces (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.restaurants (
  id uuid PRIMARY KEY,
  workspace_id uuid REFERENCES public.business_workspaces(id),
  name text NOT NULL,
  place_id text UNIQUE,
  owner_email text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.reviews (
  id uuid PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  author text,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  review_text text,
  review_timestamp bigint,
  status text NOT NULL DEFAULT 'pending'
);

CREATE TABLE public.api_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model text NOT NULL,
  operation text NOT NULL,
  input_tokens int NOT NULL DEFAULT 0,
  output_tokens int NOT NULL DEFAULT 0,
  cost_usd float NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE FUNCTION public.current_user_owns_replova_workspace(p_workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE
SET search_path = pg_catalog, pg_temp
AS $$ SELECT false $$;

\ir ../../supabase/migrations/031_business_playbook.sql

INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
  ('00000000-0000-4000-8000-000000000001', 'approver@example.com', now()),
  ('00000000-0000-4000-8000-000000000002', 'applicator@example.com', now());
INSERT INTO public.accounts (id, owner_email, auth_user_id) VALUES
  ('90000000-0000-4000-8000-000000000001', 'approver@example.com', '00000000-0000-4000-8000-000000000001'),
  ('90000000-0000-4000-8000-000000000002', 'applicator@example.com', '00000000-0000-4000-8000-000000000002');
INSERT INTO public.business_workspaces (id, account_id, name) VALUES
  ('10000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'PostgreSQL Test Workspace'),
  ('10000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000002', 'Other Workspace');
INSERT INTO public.restaurants (id, workspace_id, name, owner_email) VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Test Location', 'approver@example.com');
INSERT INTO public.reviews (id, restaurant_id, rating, review_text, review_timestamp) VALUES
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 2, 'The promised update did not arrive.', 1794765600000);

DO $$
DECLARE
  v_allowed boolean;
  v_valid_operation constant text := 'playbook_ai_limit_real_cccccccccccccccccccccccccccccccc';
BEGIN
  BEGIN
    PERFORM public.playbook_reserve_ai_run(NULL, now() - interval '10 minutes', 4);
    RAISE EXCEPTION 'NULL operation unexpectedly accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'playbook_invalid_rate_limit_request' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.playbook_reserve_ai_run(
      'playbook_ai_limit_real_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', NULL, 4
    );
    RAISE EXCEPTION 'NULL timestamp unexpectedly accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'playbook_invalid_rate_limit_request' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.playbook_reserve_ai_run(
      'playbook_ai_limit_real_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', now() - interval '10 minutes', NULL
    );
    RAISE EXCEPTION 'NULL limit unexpectedly accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'playbook_invalid_rate_limit_request' THEN RAISE; END IF;
  END;

  v_allowed := public.playbook_reserve_ai_run(v_valid_operation, now() - interval '10 minutes', 1);
  IF v_allowed IS NOT TRUE THEN RAISE EXCEPTION 'valid reservation was rejected'; END IF;
  v_allowed := public.playbook_reserve_ai_run(v_valid_operation, now() - interval '10 minutes', 1);
  IF v_allowed IS NOT FALSE THEN RAISE EXCEPTION 'valid exhausted limit was bypassed'; END IF;
END $$;

DO $$
DECLARE
  v_connection text;
  v_operation constant text := 'playbook_ai_limit_real_dddddddddddddddddddddddddddddddd';
  v_allowed boolean;
  v_allowed_count integer := 0;
  v_logged_count integer;
  v_index integer;
BEGIN
  FOR v_index IN 1..8 LOOP
    v_connection := format('playbook_rate_%s', v_index);
    PERFORM dblink_connect(v_connection, format('dbname=%L', current_database()));
    PERFORM dblink_send_query(
      v_connection,
      format(
        'SELECT public.playbook_reserve_ai_run(%L, now() - interval ''10 minutes'', 4)',
        v_operation
      )
    );
  END LOOP;

  FOR v_index IN 1..8 LOOP
    v_connection := format('playbook_rate_%s', v_index);
    SELECT result.allowed INTO v_allowed
    FROM dblink_get_result(v_connection) AS result(allowed boolean);
    IF v_allowed THEN v_allowed_count := v_allowed_count + 1; END IF;
    PERFORM dblink_disconnect(v_connection);
  END LOOP;

  SELECT count(*)::integer INTO v_logged_count
  FROM public.api_usage_log WHERE operation = v_operation;
  IF v_allowed_count <> 4 OR v_logged_count <> 4 THEN
    RAISE EXCEPTION 'concurrent reservation limit was not atomic: allowed %, logged %',
      v_allowed_count, v_logged_count;
  END IF;
END $$;

DO $$
DECLARE
  v_workspace_id constant uuid := '10000000-0000-4000-8000-000000000001';
  v_other_workspace_id constant uuid := '10000000-0000-4000-8000-000000000002';
  v_actor_id constant uuid := '00000000-0000-4000-8000-000000000001';
  v_valid_role_id uuid;
  v_inactive_role_id uuid;
  v_cross_role_id uuid;
  v_valid_person_id uuid;
  v_inactive_person_id uuid;
  v_cross_person_id uuid;
  v_proposal_id uuid;
  v_snapshot jsonb := jsonb_build_object(
    'title', 'Proposal edit validation',
    'category', 'General Operations',
    'description', 'Validate responsibility references before approval.',
    'objective', 'Reject unauthorized or inactive directory references.',
    'steps', jsonb_build_array('Review the proposal.', 'Validate responsibility references.'),
    'responsible_role_id', NULL,
    'assigned_person_id', NULL,
    'status', 'draft'
  );
  v_edited_snapshot jsonb;
BEGIN
  INSERT INTO public.playbook_roles (workspace_id, name, department)
  VALUES (v_workspace_id, 'Valid proposal role', 'Operations') RETURNING id INTO v_valid_role_id;
  INSERT INTO public.playbook_roles (workspace_id, name, department, active)
  VALUES (v_workspace_id, 'Inactive proposal role', 'Operations', false) RETURNING id INTO v_inactive_role_id;
  INSERT INTO public.playbook_roles (workspace_id, name, department)
  VALUES (v_other_workspace_id, 'Cross-workspace proposal role', 'Operations') RETURNING id INTO v_cross_role_id;

  INSERT INTO public.playbook_people (workspace_id, display_name, job_title, department, role_id)
  VALUES (v_workspace_id, 'Valid proposal person', 'Advisor', 'Operations', v_valid_role_id)
  RETURNING id INTO v_valid_person_id;
  INSERT INTO public.playbook_people (workspace_id, display_name, job_title, department, active)
  VALUES (v_workspace_id, 'Inactive proposal person', 'Advisor', 'Operations', false)
  RETURNING id INTO v_inactive_person_id;
  INSERT INTO public.playbook_people (workspace_id, display_name, job_title, department)
  VALUES (v_other_workspace_id, 'Cross-workspace proposal person', 'Advisor', 'Operations')
  RETURNING id INTO v_cross_person_id;

  INSERT INTO public.playbook_change_proposals (
    workspace_id, proposal_kind, problem, proposed_snapshot, expected_benefit,
    priority, rationale, status, model
  ) VALUES (
    v_workspace_id, 'new_procedure', 'Responsibility references require validation.', v_snapshot,
    'Hypothesis: early validation prevents invalid approved changes.', 'medium',
    'This proposal exercises edit-time responsibility checks.', 'pending', 'test-model'
  ) RETURNING id INTO v_proposal_id;

  BEGIN
    PERFORM public.playbook_review_proposal(
      v_workspace_id, v_proposal_id, 1, v_actor_id, 'edit',
      jsonb_build_object('proposed_snapshot', v_snapshot || jsonb_build_object('responsible_role_id', v_cross_role_id::text))
    );
    RAISE EXCEPTION 'cross-workspace snapshot role unexpectedly accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'playbook_invalid_role' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.playbook_review_proposal(
      v_workspace_id, v_proposal_id, 1, v_actor_id, 'edit',
      jsonb_build_object('proposed_snapshot', v_snapshot || jsonb_build_object('responsible_role_id', v_inactive_role_id::text))
    );
    RAISE EXCEPTION 'inactive snapshot role unexpectedly accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'playbook_invalid_role' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.playbook_review_proposal(
      v_workspace_id, v_proposal_id, 1, v_actor_id, 'edit',
      jsonb_build_object('proposed_snapshot', v_snapshot || jsonb_build_object('assigned_person_id', v_cross_person_id::text))
    );
    RAISE EXCEPTION 'cross-workspace snapshot person unexpectedly accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'playbook_invalid_person' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.playbook_review_proposal(
      v_workspace_id, v_proposal_id, 1, v_actor_id, 'edit',
      jsonb_build_object('proposed_snapshot', v_snapshot || jsonb_build_object('assigned_person_id', v_inactive_person_id::text))
    );
    RAISE EXCEPTION 'inactive snapshot person unexpectedly accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'playbook_invalid_person' THEN RAISE; END IF;
  END;

  PERFORM public.playbook_review_proposal(
    v_workspace_id, v_proposal_id, 1, v_actor_id, 'edit',
    jsonb_build_object(
      'proposed_snapshot', v_snapshot || jsonb_build_object(
        'responsible_role_id', v_valid_role_id::text,
        'assigned_person_id', v_valid_person_id::text
      )
    )
  );
  SELECT proposed_snapshot INTO v_edited_snapshot
  FROM public.playbook_change_proposals WHERE id = v_proposal_id;
  IF v_edited_snapshot->>'responsible_role_id' <> v_valid_role_id::text
    OR v_edited_snapshot->>'assigned_person_id' <> v_valid_person_id::text THEN
    RAISE EXCEPTION 'valid proposal responsibility edit was not saved';
  END IF;
END $$;

DO $$
DECLARE
  v_workspace_id constant uuid := '10000000-0000-4000-8000-000000000001';
  v_approver_id constant uuid := '00000000-0000-4000-8000-000000000001';
  v_role_id uuid;
  v_person_id uuid;
  v_procedure_id uuid;
  v_proposal_id uuid;
  v_task_id uuid;
  v_retained_procedure_id uuid;
  v_retained_proposal_id uuid;
  v_retained_version_id uuid;
  v_retained_task_id uuid;
  v_applied_proposal_id uuid;
  v_snapshot jsonb := jsonb_build_object(
    'title', 'Customer status updates',
    'category', 'Customer Communication',
    'description', 'Set and meet the next customer update time.',
    'objective', 'Make progress communication reliable.',
    'steps', jsonb_build_array('Record the next update time.', 'Contact the customer by that time.'),
    'responsible_role_id', NULL,
    'assigned_person_id', NULL,
    'status', 'draft'
  );
BEGIN
  INSERT INTO public.playbook_roles (workspace_id, name, department)
  VALUES (v_workspace_id, 'Deletion Role', 'Operations') RETURNING id INTO v_role_id;
  INSERT INTO public.playbook_people (workspace_id, display_name, job_title, department, role_id)
  VALUES (v_workspace_id, 'Deletion Person', 'Advisor', 'Operations', v_role_id) RETURNING id INTO v_person_id;
  v_snapshot := jsonb_set(jsonb_set(v_snapshot, '{responsible_role_id}', to_jsonb(v_role_id::text)), '{assigned_person_id}', to_jsonb(v_person_id::text));
  v_procedure_id := public.playbook_create_procedure(v_workspace_id, v_approver_id, v_snapshot, 'Initial deletion procedure');
  INSERT INTO public.playbook_change_proposals (
    workspace_id, procedure_id, proposal_kind, problem, proposed_snapshot,
    expected_benefit, priority, rationale, suggested_role_id, model
  ) VALUES (
    v_workspace_id, v_procedure_id, 'change_procedure', 'Deletion must preserve the workspace tenant key.', v_snapshot,
    'Hypothesis: safe nulling retains related records.', 'medium',
    'This proposal exercises composite foreign-key deletion behavior.', v_role_id, 'test-model'
  ) RETURNING id INTO v_proposal_id;
  INSERT INTO public.playbook_tasks (workspace_id, procedure_id, proposal_id, role_id, person_id, title)
  VALUES (v_workspace_id, v_procedure_id, v_proposal_id, v_role_id, v_person_id, 'Deletion relationship regression')
  RETURNING id INTO v_task_id;

  DELETE FROM public.playbook_roles WHERE id = v_role_id;
  IF EXISTS (
    SELECT 1 FROM public.playbook_people people
    WHERE people.id = v_person_id
      AND (people.workspace_id IS DISTINCT FROM v_workspace_id OR people.role_id IS NOT NULL)
  ) THEN RAISE EXCEPTION 'role deletion damaged person workspace or failed to null role'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.playbook_procedures procedures
    WHERE procedures.id = v_procedure_id AND procedures.workspace_id = v_workspace_id
      AND procedures.responsible_role_id IS NULL AND procedures.assigned_person_id = v_person_id
  ) THEN RAISE EXCEPTION 'role deletion damaged procedure workspace or assignment'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.playbook_change_proposals proposals
    WHERE proposals.id = v_proposal_id AND proposals.workspace_id = v_workspace_id AND proposals.suggested_role_id IS NULL
  ) THEN RAISE EXCEPTION 'role deletion damaged proposal workspace'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.playbook_tasks tasks
    WHERE tasks.id = v_task_id AND tasks.workspace_id = v_workspace_id AND tasks.role_id IS NULL
  ) THEN RAISE EXCEPTION 'role deletion damaged task workspace'; END IF;

  DELETE FROM public.playbook_people WHERE id = v_person_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.playbook_procedures procedures
    WHERE procedures.id = v_procedure_id AND procedures.workspace_id = v_workspace_id AND procedures.assigned_person_id IS NULL
  ) THEN RAISE EXCEPTION 'person deletion damaged procedure workspace'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.playbook_tasks tasks
    WHERE tasks.id = v_task_id AND tasks.workspace_id = v_workspace_id AND tasks.person_id IS NULL
  ) THEN RAISE EXCEPTION 'person deletion damaged task workspace'; END IF;

  DELETE FROM public.playbook_procedures WHERE id = v_procedure_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.playbook_tasks tasks
    WHERE tasks.id = v_task_id AND tasks.workspace_id = v_workspace_id
      AND tasks.procedure_id IS NULL AND tasks.proposal_id IS NULL
  ) THEN RAISE EXCEPTION 'procedure deletion damaged task workspace or failed to null references'; END IF;
  IF EXISTS (SELECT 1 FROM public.playbook_versions versions WHERE versions.procedure_id = v_procedure_id)
    OR EXISTS (SELECT 1 FROM public.playbook_change_proposals proposals WHERE proposals.id = v_proposal_id) THEN
    RAISE EXCEPTION 'procedure-owned history did not cascade';
  END IF;

  v_snapshot := jsonb_set(jsonb_set(v_snapshot, '{responsible_role_id}', 'null'::jsonb), '{assigned_person_id}', 'null'::jsonb);
  v_retained_procedure_id := public.playbook_create_procedure(v_workspace_id, v_approver_id, v_snapshot, 'Retained audit procedure');
  INSERT INTO public.playbook_change_proposals (
    workspace_id, procedure_id, proposal_kind, problem, proposed_snapshot,
    expected_benefit, priority, rationale, model
  ) VALUES (
    v_workspace_id, v_retained_procedure_id, 'change_procedure', 'Proposal deletion must retain audit history.', v_snapshot,
    'Hypothesis: retained history supports later audits.', 'low',
    'This proposal verifies nullable proposal references.', 'test-model'
  ) RETURNING id INTO v_retained_proposal_id;
  INSERT INTO public.playbook_versions (
    workspace_id, procedure_id, version_number, snapshot, change_summary, source, source_proposal_id
  ) VALUES (
    v_workspace_id, v_retained_procedure_id, 2, v_snapshot, 'Proposal-linked audit version', 'ai_proposal', v_retained_proposal_id
  ) RETURNING id INTO v_retained_version_id;
  INSERT INTO public.playbook_tasks (workspace_id, proposal_id, title)
  VALUES (v_workspace_id, v_retained_proposal_id, 'Retain task after proposal deletion') RETURNING id INTO v_retained_task_id;
  INSERT INTO public.playbook_proposal_evidence (workspace_id, proposal_id, restaurant_id, review_id)
  VALUES (v_workspace_id, v_retained_proposal_id, '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001');

  DELETE FROM public.playbook_change_proposals WHERE id = v_retained_proposal_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.playbook_versions versions
    WHERE versions.id = v_retained_version_id AND versions.workspace_id = v_workspace_id AND versions.source_proposal_id IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM public.playbook_tasks tasks
    WHERE tasks.id = v_retained_task_id AND tasks.workspace_id = v_workspace_id AND tasks.proposal_id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.playbook_proposal_evidence evidence WHERE evidence.proposal_id = v_retained_proposal_id
  ) THEN RAISE EXCEPTION 'proposal deletion did not preserve nullable audit relationships'; END IF;

  INSERT INTO public.playbook_change_proposals (
    workspace_id, procedure_id, proposal_kind, problem, proposed_snapshot,
    expected_benefit, priority, rationale, model, status, approved_by, approved_at, applied_version_id
  ) VALUES (
    v_workspace_id, v_retained_procedure_id, 'change_procedure', 'Applied version deletion must preserve the workspace.', v_snapshot,
    'Hypothesis: safe nulling retains the proposal audit.', 'low',
    'This proposal verifies applied-version deletion behavior.', 'test-model', 'applied', v_approver_id, now(), v_retained_version_id
  ) RETURNING id INTO v_applied_proposal_id;
  DELETE FROM public.playbook_versions WHERE id = v_retained_version_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.playbook_change_proposals proposals WHERE proposals.id = v_applied_proposal_id
      AND proposals.workspace_id = v_workspace_id AND proposals.applied_version_id IS NULL
  ) THEN RAISE EXCEPTION 'version deletion damaged proposal workspace'; END IF;
END $$;

DO $$
DECLARE
  v_workspace_id constant uuid := '10000000-0000-4000-8000-000000000001';
  v_approver_id constant uuid := '00000000-0000-4000-8000-000000000001';
  v_applicator_id constant uuid := '00000000-0000-4000-8000-000000000002';
  v_procedure_id uuid;
  v_proposal_id uuid;
  v_result jsonb;
  v_audit_approver uuid;
  v_audit_applicator uuid;
  v_snapshot jsonb := jsonb_build_object(
    'title', 'Approval audit procedure',
    'category', 'Customer Communication',
    'description', 'Preserve approval and application identities.',
    'objective', 'Maintain a trustworthy audit trail.',
    'steps', jsonb_build_array('Approve the proposal.', 'Apply it separately.'),
    'responsible_role_id', NULL,
    'assigned_person_id', NULL,
    'status', 'draft'
  );
BEGIN
  v_procedure_id := public.playbook_create_procedure(v_workspace_id, v_approver_id, v_snapshot, 'Initial approval audit');
  INSERT INTO public.playbook_change_proposals (
    workspace_id, procedure_id, proposal_kind, problem, proposed_snapshot,
    expected_benefit, priority, rationale, model, created_by
  ) VALUES (
    v_workspace_id, v_procedure_id, 'change_procedure', 'Approval and application identities must remain distinct.', v_snapshot,
    'Hypothesis: distinct attribution improves the audit record.', 'high',
    'The procedure version must retain both actors.', 'test-model', v_approver_id
  ) RETURNING id INTO v_proposal_id;

  BEGIN
    PERFORM public.playbook_apply_proposal(v_workspace_id, v_proposal_id, 1, 1, v_applicator_id, 'Premature apply');
    RAISE EXCEPTION 'unapproved proposal unexpectedly applied';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%playbook_proposal_not_approved%' THEN RAISE; END IF;
  END;

  PERFORM public.playbook_review_proposal(v_workspace_id, v_proposal_id, 1, v_approver_id, 'approve', NULL);
  v_result := public.playbook_apply_proposal(v_workspace_id, v_proposal_id, 2, 1, v_applicator_id, 'Applied by authorized operator');
  SELECT versions.approved_by, versions.created_by INTO v_audit_approver, v_audit_applicator
  FROM public.playbook_versions versions WHERE versions.id = (v_result->>'version_id')::uuid;
  IF v_audit_approver <> v_approver_id OR v_audit_applicator <> v_applicator_id THEN
    RAISE EXCEPTION 'approval/application audit identities were not preserved';
  END IF;
  v_result := public.playbook_apply_proposal(v_workspace_id, v_proposal_id, 999, 999, v_applicator_id, 'Repeated apply');
  IF coalesce((v_result->>'already_applied')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'repeated application was not idempotent';
  END IF;

  BEGIN
    PERFORM public.playbook_update_procedure(v_workspace_id, v_procedure_id, 1, v_approver_id, v_snapshot, 'Stale update');
    RAISE EXCEPTION 'stale procedure update unexpectedly succeeded';
  EXCEPTION WHEN serialization_failure THEN NULL;
  END;
END $$;

DO $$
DECLARE
  function_record record;
  expected_path text := 'search_path=pg_catalog, pg_temp';
BEGIN
  IF to_regprocedure('public.current_user_owns_replova_workspace(uuid)') IS NULL THEN
    RAISE EXCEPTION 'workspace ownership helper is missing';
  END IF;
  FOR function_record IN
    SELECT procedure.oid, procedure.proname, procedure.proconfig
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname IN (
        'playbook_reserve_ai_run', 'playbook_create_procedure',
        'playbook_update_procedure', 'playbook_create_ai_proposals',
        'playbook_review_proposal', 'playbook_apply_proposal'
      )
  LOOP
    IF NOT expected_path = ANY(function_record.proconfig) THEN
      RAISE EXCEPTION 'unsafe search_path on %', function_record.proname;
    END IF;
    IF has_function_privilege('anon', function_record.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', function_record.oid, 'EXECUTE')
      OR NOT has_function_privilege('service_role', function_record.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'incorrect execute privileges on %', function_record.proname;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_proc procedure JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = 'public' AND procedure.prosecdef
        AND procedure.proname LIKE 'playbook_%') <> 6 THEN
    RAISE EXCEPTION 'unexpected SECURITY DEFINER function count';
  END IF;
  IF has_schema_privilege('anon', 'pg_catalog', 'CREATE')
    OR has_schema_privilege('authenticated', 'pg_catalog', 'CREATE')
    OR has_schema_privilege('service_role', 'pg_catalog', 'CREATE') THEN
    RAISE EXCEPTION 'an application role can create shadow objects in pg_catalog';
  END IF;
END $$;

DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.playbook_create_procedure(
      '10000000-0000-4000-8000-000000000001'::uuid,
      '00000000-0000-4000-8000-000000000001'::uuid,
      '{}'::jsonb,
      'Unauthorized attempt'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  EXECUTE 'RESET ROLE';
  IF NOT v_denied THEN
    RAISE EXCEPTION 'authenticated role invoked a privileged Playbook function';
  END IF;
END $$;

DO $$
DECLARE
  v_procedure_id uuid;
  v_snapshot jsonb := jsonb_build_object(
    'title', 'Secure search path procedure',
    'category', 'General Operations',
    'description', 'Verify temporary objects cannot shadow tenant tables.',
    'objective', 'Keep privileged references bound to public objects.',
    'steps', jsonb_build_array('Create a temporary shadow.', 'Call the secured function.'),
    'responsible_role_id', NULL,
    'assigned_person_id', NULL,
    'status', 'draft'
  );
BEGIN
  EXECUTE 'SET LOCAL ROLE service_role';
  EXECUTE 'CREATE TEMP TABLE playbook_procedures (id uuid)';
  v_procedure_id := public.playbook_create_procedure(
    '10000000-0000-4000-8000-000000000001'::uuid,
    '00000000-0000-4000-8000-000000000001'::uuid,
    v_snapshot,
    'Secure search path test'
  );
  EXECUTE 'RESET ROLE';
  IF NOT EXISTS (
    SELECT 1 FROM public.playbook_procedures procedures WHERE procedures.id = v_procedure_id
  ) THEN
    RAISE EXCEPTION 'temporary relation shadowed the secured public table reference';
  END IF;
END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'CREATE FUNCTION public.playbook_atomic_privilege_probe() RETURNS integer LANGUAGE sql SECURITY DEFINER AS ''SELECT 1''';
    EXECUTE 'REVOKE ALL ON FUNCTION public.playbook_atomic_privilege_probe() FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.playbook_atomic_privilege_probe() TO service_role';
    RAISE EXCEPTION 'forced transactional rollback';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  IF to_regprocedure('public.playbook_atomic_privilege_probe()') IS NOT NULL THEN
    RAISE EXCEPTION 'function privilege DDL survived a failed transaction block';
  END IF;
END $$;

SELECT 'playbook migration 031 PostgreSQL regression tests passed' AS result;
