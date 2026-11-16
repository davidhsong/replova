-- Business Playbook MVP.
--
-- Additive and independent of parked migration 026 and absent migration 029.
-- This migration must be reviewed and applied manually. It never seeds demo
-- data and never reads or writes external provider credentials.
--
-- Supabase's migration runner wraps each migration file in one transaction.
-- Keep this file free of BEGIN/COMMIT and transaction=false directives so
-- function creation, privilege revocation, and selective grants stay atomic.
-- Column-specific SET NULL actions require PostgreSQL 15 or newer.

-- Workspace-aware evidence foreign keys require stable composite candidates.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'restaurants_workspace_id_id_unique'
      AND conrelid = 'restaurants'::regclass
  ) THEN
    ALTER TABLE restaurants
      ADD CONSTRAINT restaurants_workspace_id_id_unique UNIQUE (workspace_id, id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reviews_restaurant_id_id_unique'
      AND conrelid = 'reviews'::regclass
  ) THEN
    ALTER TABLE reviews
      ADD CONSTRAINT reviews_restaurant_id_id_unique UNIQUE (restaurant_id, id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS playbook_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES business_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  department text NOT NULL DEFAULT 'General Operations',
  responsibilities text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT playbook_roles_workspace_id_id_unique UNIQUE (workspace_id, id),
  CONSTRAINT playbook_roles_name_length CHECK (char_length(trim(name)) BETWEEN 2 AND 120),
  CONSTRAINT playbook_roles_department_length CHECK (char_length(trim(department)) BETWEEN 2 AND 100),
  CONSTRAINT playbook_roles_responsibilities_length CHECK (char_length(responsibilities) <= 2000)
);

CREATE UNIQUE INDEX IF NOT EXISTS playbook_roles_active_name_unique
  ON playbook_roles (workspace_id, lower(trim(name)))
  WHERE active = true;

CREATE TABLE IF NOT EXISTS playbook_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES business_workspaces(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  job_title text NOT NULL,
  department text NOT NULL DEFAULT 'General Operations',
  responsibilities text NOT NULL DEFAULT '',
  role_id uuid,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT playbook_people_workspace_id_id_unique UNIQUE (workspace_id, id),
  CONSTRAINT playbook_people_role_fkey
    FOREIGN KEY (workspace_id, role_id)
    REFERENCES playbook_roles(workspace_id, id)
    ON DELETE SET NULL (role_id),
  CONSTRAINT playbook_people_name_length CHECK (char_length(trim(display_name)) BETWEEN 2 AND 120),
  CONSTRAINT playbook_people_title_length CHECK (char_length(trim(job_title)) BETWEEN 2 AND 120),
  CONSTRAINT playbook_people_department_length CHECK (char_length(trim(department)) BETWEEN 2 AND 100),
  CONSTRAINT playbook_people_responsibilities_length CHECK (char_length(responsibilities) <= 2000)
);

CREATE TABLE IF NOT EXISTS playbook_procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES business_workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL,
  description text NOT NULL DEFAULT '',
  objective text NOT NULL DEFAULT '',
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  responsible_role_id uuid,
  assigned_person_id uuid,
  status text NOT NULL DEFAULT 'draft',
  current_version integer NOT NULL DEFAULT 1,
  lock_version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT playbook_procedures_workspace_id_id_unique UNIQUE (workspace_id, id),
  CONSTRAINT playbook_procedures_role_fkey
    FOREIGN KEY (workspace_id, responsible_role_id)
    REFERENCES playbook_roles(workspace_id, id)
    ON DELETE SET NULL (responsible_role_id),
  CONSTRAINT playbook_procedures_person_fkey
    FOREIGN KEY (workspace_id, assigned_person_id)
    REFERENCES playbook_people(workspace_id, id)
    ON DELETE SET NULL (assigned_person_id),
  CONSTRAINT playbook_procedures_title_length CHECK (char_length(trim(title)) BETWEEN 3 AND 180),
  CONSTRAINT playbook_procedures_category CHECK (category IN (
    'Customer Communication', 'Scheduling', 'Service Delivery', 'Quality Control',
    'Complaint Resolution', 'Billing & Estimates', 'Customer Follow-Up', 'General Operations'
  )),
  CONSTRAINT playbook_procedures_description_length CHECK (char_length(description) <= 4000),
  CONSTRAINT playbook_procedures_objective_length CHECK (char_length(objective) <= 2000),
  CONSTRAINT playbook_procedures_steps_array CHECK (jsonb_typeof(steps) = 'array'),
  CONSTRAINT playbook_procedures_status CHECK (status IN ('draft', 'active', 'archived')),
  CONSTRAINT playbook_procedures_version_positive CHECK (current_version > 0 AND lock_version > 0)
);

CREATE TABLE IF NOT EXISTS playbook_change_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES business_workspaces(id) ON DELETE CASCADE,
  procedure_id uuid,
  proposal_kind text NOT NULL,
  problem text NOT NULL,
  proposed_snapshot jsonb NOT NULL,
  expected_benefit text NOT NULL,
  priority text NOT NULL,
  rationale text NOT NULL,
  suggested_role_id uuid,
  status text NOT NULL DEFAULT 'pending',
  model text NOT NULL,
  lock_version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  edited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rejected_at timestamptz,
  applied_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT playbook_proposals_workspace_id_id_unique UNIQUE (workspace_id, id),
  CONSTRAINT playbook_proposals_procedure_fkey
    FOREIGN KEY (workspace_id, procedure_id)
    REFERENCES playbook_procedures(workspace_id, id)
    ON DELETE CASCADE,
  CONSTRAINT playbook_proposals_role_fkey
    FOREIGN KEY (workspace_id, suggested_role_id)
    REFERENCES playbook_roles(workspace_id, id)
    ON DELETE SET NULL (suggested_role_id),
  CONSTRAINT playbook_proposals_kind CHECK (proposal_kind IN ('new_procedure', 'change_procedure')),
  CONSTRAINT playbook_proposals_problem_length CHECK (char_length(trim(problem)) BETWEEN 10 AND 2000),
  CONSTRAINT playbook_proposals_benefit_length CHECK (char_length(trim(expected_benefit)) BETWEEN 10 AND 1200),
  CONSTRAINT playbook_proposals_priority CHECK (priority IN ('high', 'medium', 'low')),
  CONSTRAINT playbook_proposals_rationale_length CHECK (char_length(trim(rationale)) BETWEEN 10 AND 2000),
  CONSTRAINT playbook_proposals_status CHECK (status IN ('pending', 'approved', 'rejected', 'applied')),
  CONSTRAINT playbook_proposals_model_length CHECK (char_length(trim(model)) BETWEEN 1 AND 120),
  CONSTRAINT playbook_proposals_lock_positive CHECK (lock_version > 0)
);

CREATE TABLE IF NOT EXISTS playbook_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES business_workspaces(id) ON DELETE CASCADE,
  procedure_id uuid NOT NULL,
  version_number integer NOT NULL,
  snapshot jsonb NOT NULL,
  change_summary text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  source_proposal_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT playbook_versions_workspace_id_id_unique UNIQUE (workspace_id, id),
  CONSTRAINT playbook_versions_procedure_fkey
    FOREIGN KEY (workspace_id, procedure_id)
    REFERENCES playbook_procedures(workspace_id, id)
    ON DELETE CASCADE,
  CONSTRAINT playbook_versions_proposal_fkey
    FOREIGN KEY (workspace_id, source_proposal_id)
    REFERENCES playbook_change_proposals(workspace_id, id)
    ON DELETE SET NULL (source_proposal_id),
  CONSTRAINT playbook_versions_number_unique UNIQUE (procedure_id, version_number),
  CONSTRAINT playbook_versions_number_positive CHECK (version_number > 0),
  CONSTRAINT playbook_versions_summary_length CHECK (char_length(trim(change_summary)) BETWEEN 3 AND 1000),
  CONSTRAINT playbook_versions_source CHECK (source IN ('manual', 'ai_proposal', 'restore'))
);

ALTER TABLE playbook_change_proposals
  DROP CONSTRAINT IF EXISTS playbook_proposals_applied_version_fkey;
ALTER TABLE playbook_change_proposals
  ADD CONSTRAINT playbook_proposals_applied_version_fkey
  FOREIGN KEY (workspace_id, applied_version_id)
  REFERENCES playbook_versions(workspace_id, id)
  ON DELETE SET NULL (applied_version_id);

CREATE TABLE IF NOT EXISTS playbook_proposal_evidence (
  workspace_id uuid NOT NULL,
  proposal_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  review_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (proposal_id, review_id),
  CONSTRAINT playbook_evidence_proposal_fkey
    FOREIGN KEY (workspace_id, proposal_id)
    REFERENCES playbook_change_proposals(workspace_id, id)
    ON DELETE CASCADE,
  CONSTRAINT playbook_evidence_restaurant_fkey
    FOREIGN KEY (workspace_id, restaurant_id)
    REFERENCES restaurants(workspace_id, id)
    ON DELETE CASCADE,
  CONSTRAINT playbook_evidence_review_fkey
    FOREIGN KEY (restaurant_id, review_id)
    REFERENCES reviews(restaurant_id, id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS playbook_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES business_workspaces(id) ON DELETE CASCADE,
  procedure_id uuid,
  proposal_id uuid,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  role_id uuid,
  person_id uuid,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'todo',
  due_date date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT playbook_tasks_workspace_id_id_unique UNIQUE (workspace_id, id),
  CONSTRAINT playbook_tasks_procedure_fkey
    FOREIGN KEY (workspace_id, procedure_id)
    REFERENCES playbook_procedures(workspace_id, id)
    ON DELETE SET NULL (procedure_id),
  CONSTRAINT playbook_tasks_proposal_fkey
    FOREIGN KEY (workspace_id, proposal_id)
    REFERENCES playbook_change_proposals(workspace_id, id)
    ON DELETE SET NULL (proposal_id),
  CONSTRAINT playbook_tasks_role_fkey
    FOREIGN KEY (workspace_id, role_id)
    REFERENCES playbook_roles(workspace_id, id)
    ON DELETE SET NULL (role_id),
  CONSTRAINT playbook_tasks_person_fkey
    FOREIGN KEY (workspace_id, person_id)
    REFERENCES playbook_people(workspace_id, id)
    ON DELETE SET NULL (person_id),
  CONSTRAINT playbook_tasks_title_length CHECK (char_length(trim(title)) BETWEEN 3 AND 220),
  CONSTRAINT playbook_tasks_description_length CHECK (char_length(description) <= 2000),
  CONSTRAINT playbook_tasks_priority CHECK (priority IN ('high', 'medium', 'low')),
  CONSTRAINT playbook_tasks_status CHECK (status IN ('todo', 'in_progress', 'done'))
);

CREATE INDEX IF NOT EXISTS playbook_roles_workspace_idx
  ON playbook_roles (workspace_id, active DESC, name, id);
CREATE INDEX IF NOT EXISTS playbook_people_workspace_idx
  ON playbook_people (workspace_id, active DESC, display_name, id);
CREATE INDEX IF NOT EXISTS playbook_procedures_workspace_idx
  ON playbook_procedures (workspace_id, status, updated_at DESC, id);
CREATE INDEX IF NOT EXISTS playbook_versions_procedure_idx
  ON playbook_versions (workspace_id, procedure_id, version_number DESC);
CREATE INDEX IF NOT EXISTS playbook_proposals_workspace_idx
  ON playbook_change_proposals (workspace_id, status, created_at DESC, id);
CREATE INDEX IF NOT EXISTS playbook_evidence_review_idx
  ON playbook_proposal_evidence (workspace_id, review_id, proposal_id);
CREATE INDEX IF NOT EXISTS playbook_tasks_workspace_idx
  ON playbook_tasks (workspace_id, status, priority, updated_at DESC, id);
CREATE INDEX IF NOT EXISTS api_usage_log_operation_created_idx
  ON api_usage_log (operation, created_at DESC);

CREATE OR REPLACE FUNCTION set_playbook_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS playbook_roles_updated_at ON playbook_roles;
CREATE TRIGGER playbook_roles_updated_at BEFORE UPDATE ON playbook_roles
FOR EACH ROW EXECUTE FUNCTION set_playbook_updated_at();
DROP TRIGGER IF EXISTS playbook_people_updated_at ON playbook_people;
CREATE TRIGGER playbook_people_updated_at BEFORE UPDATE ON playbook_people
FOR EACH ROW EXECUTE FUNCTION set_playbook_updated_at();
DROP TRIGGER IF EXISTS playbook_procedures_updated_at ON playbook_procedures;
CREATE TRIGGER playbook_procedures_updated_at BEFORE UPDATE ON playbook_procedures
FOR EACH ROW EXECUTE FUNCTION set_playbook_updated_at();
DROP TRIGGER IF EXISTS playbook_proposals_updated_at ON playbook_change_proposals;
CREATE TRIGGER playbook_proposals_updated_at BEFORE UPDATE ON playbook_change_proposals
FOR EACH ROW EXECUTE FUNCTION set_playbook_updated_at();
DROP TRIGGER IF EXISTS playbook_tasks_updated_at ON playbook_tasks;
CREATE TRIGGER playbook_tasks_updated_at BEFORE UPDATE ON playbook_tasks
FOR EACH ROW EXECUTE FUNCTION set_playbook_updated_at();

CREATE OR REPLACE FUNCTION playbook_snapshot_is_valid(p_snapshot jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_step jsonb;
BEGIN
  IF p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'object' THEN RETURN false; END IF;
  IF char_length(trim(coalesce(p_snapshot->>'title', ''))) NOT BETWEEN 3 AND 180 THEN RETURN false; END IF;
  IF coalesce(p_snapshot->>'category', '') NOT IN (
    'Customer Communication', 'Scheduling', 'Service Delivery', 'Quality Control',
    'Complaint Resolution', 'Billing & Estimates', 'Customer Follow-Up', 'General Operations'
  ) THEN RETURN false; END IF;
  IF char_length(coalesce(p_snapshot->>'description', '')) > 4000 THEN RETURN false; END IF;
  IF char_length(coalesce(p_snapshot->>'objective', '')) > 2000 THEN RETURN false; END IF;
  IF coalesce(p_snapshot->>'status', '') NOT IN ('draft', 'active', 'archived') THEN RETURN false; END IF;
  IF jsonb_typeof(p_snapshot->'steps') <> 'array'
    OR jsonb_array_length(p_snapshot->'steps') NOT BETWEEN 1 AND 30 THEN RETURN false; END IF;
  FOR v_step IN SELECT value FROM jsonb_array_elements(p_snapshot->'steps') LOOP
    IF jsonb_typeof(v_step) <> 'string'
      OR char_length(trim(v_step #>> '{}')) NOT BETWEEN 1 AND 500 THEN RETURN false; END IF;
  END LOOP;
  IF nullif(p_snapshot->>'responsible_role_id', '') IS NOT NULL
    AND (p_snapshot->>'responsible_role_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RETURN false; END IF;
  IF nullif(p_snapshot->>'assigned_person_id', '') IS NOT NULL
    AND (p_snapshot->>'assigned_person_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RETURN false; END IF;
  RETURN true;
END;
$$;

-- The advisory transaction lock makes the durable rate-limit reservation
-- atomic across Vercel instances. A failed AI call still consumes a slot,
-- preventing retry storms from creating unbounded spend.
CREATE OR REPLACE FUNCTION playbook_reserve_ai_run(
  p_operation text,
  p_window_start timestamptz,
  p_limit integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_operation IS NULL
    OR p_window_start IS NULL
    OR p_limit IS NULL
    OR p_operation !~ '^playbook_ai_limit_(real|demo)_[0-9a-f]{32}$'
    OR p_limit NOT BETWEEN 1 AND 20
    OR p_window_start < now() - interval '1 day'
    OR p_window_start > now() THEN
    RAISE EXCEPTION 'playbook_invalid_rate_limit_request';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_operation));
  SELECT count(*)::integer INTO v_count
  FROM public.api_usage_log
  WHERE operation = p_operation AND created_at >= p_window_start;

  IF v_count >= p_limit THEN RETURN false; END IF;

  INSERT INTO public.api_usage_log (model, operation, input_tokens, output_tokens, cost_usd)
  VALUES ('rate-limit-reservation', p_operation, 0, 0, 0);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION playbook_create_procedure(
  p_workspace_id uuid,
  p_actor_id uuid,
  p_snapshot jsonb,
  p_change_summary text DEFAULT 'Initial procedure'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_procedure_id uuid;
  v_role_id uuid := nullif(p_snapshot->>'responsible_role_id', '')::uuid;
  v_person_id uuid := nullif(p_snapshot->>'assigned_person_id', '')::uuid;
BEGIN
  IF NOT public.playbook_snapshot_is_valid(p_snapshot) THEN RAISE EXCEPTION 'playbook_invalid_snapshot'; END IF;
  IF char_length(trim(coalesce(p_change_summary, ''))) NOT BETWEEN 3 AND 1000 THEN
    RAISE EXCEPTION 'playbook_invalid_change_summary';
  END IF;
  IF v_role_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.playbook_roles WHERE workspace_id = p_workspace_id AND id = v_role_id AND active
  ) THEN RAISE EXCEPTION 'playbook_invalid_role'; END IF;
  IF v_person_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.playbook_people WHERE workspace_id = p_workspace_id AND id = v_person_id AND active
  ) THEN RAISE EXCEPTION 'playbook_invalid_person'; END IF;

  INSERT INTO public.playbook_procedures (
    workspace_id, title, category, description, objective, steps,
    responsible_role_id, assigned_person_id, status, created_by, updated_by
  ) VALUES (
    p_workspace_id, trim(p_snapshot->>'title'), p_snapshot->>'category',
    coalesce(p_snapshot->>'description', ''), coalesce(p_snapshot->>'objective', ''), p_snapshot->'steps',
    v_role_id, v_person_id, p_snapshot->>'status', p_actor_id, p_actor_id
  ) RETURNING id INTO v_procedure_id;

  INSERT INTO public.playbook_versions (
    workspace_id, procedure_id, version_number, snapshot, change_summary,
    source, created_by, approved_by
  ) VALUES (
    p_workspace_id, v_procedure_id, 1, p_snapshot, trim(p_change_summary),
    'manual', p_actor_id,
    CASE WHEN p_snapshot->>'status' = 'active' THEN p_actor_id ELSE NULL END
  );

  RETURN v_procedure_id;
END;
$$;

CREATE OR REPLACE FUNCTION playbook_update_procedure(
  p_workspace_id uuid,
  p_procedure_id uuid,
  p_expected_lock_version integer,
  p_actor_id uuid,
  p_snapshot jsonb,
  p_change_summary text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_current public.playbook_procedures%ROWTYPE;
  v_version_id uuid;
  v_next_version integer;
  v_role_id uuid := nullif(p_snapshot->>'responsible_role_id', '')::uuid;
  v_person_id uuid := nullif(p_snapshot->>'assigned_person_id', '')::uuid;
BEGIN
  IF NOT public.playbook_snapshot_is_valid(p_snapshot) THEN RAISE EXCEPTION 'playbook_invalid_snapshot'; END IF;
  IF char_length(trim(coalesce(p_change_summary, ''))) NOT BETWEEN 3 AND 1000 THEN
    RAISE EXCEPTION 'playbook_invalid_change_summary';
  END IF;

  SELECT * INTO v_current FROM public.playbook_procedures
  WHERE workspace_id = p_workspace_id AND id = p_procedure_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'playbook_procedure_not_found'; END IF;
  IF v_current.lock_version <> p_expected_lock_version THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'playbook_procedure_conflict';
  END IF;
  IF v_role_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.playbook_roles WHERE workspace_id = p_workspace_id AND id = v_role_id AND active
  ) THEN RAISE EXCEPTION 'playbook_invalid_role'; END IF;
  IF v_person_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.playbook_people WHERE workspace_id = p_workspace_id AND id = v_person_id AND active
  ) THEN RAISE EXCEPTION 'playbook_invalid_person'; END IF;

  v_next_version := v_current.current_version + 1;
  UPDATE public.playbook_procedures SET
    title = trim(p_snapshot->>'title'), category = p_snapshot->>'category',
    description = coalesce(p_snapshot->>'description', ''), objective = coalesce(p_snapshot->>'objective', ''),
    steps = p_snapshot->'steps', responsible_role_id = v_role_id, assigned_person_id = v_person_id,
    status = p_snapshot->>'status', current_version = v_next_version,
    lock_version = lock_version + 1, updated_by = p_actor_id
  WHERE id = p_procedure_id;

  INSERT INTO public.playbook_versions (
    workspace_id, procedure_id, version_number, snapshot, change_summary,
    source, created_by, approved_by
  ) VALUES (
    p_workspace_id, p_procedure_id, v_next_version, p_snapshot, trim(p_change_summary),
    'manual', p_actor_id,
    CASE WHEN p_snapshot->>'status' = 'active' THEN p_actor_id ELSE NULL END
  ) RETURNING id INTO v_version_id;
  RETURN v_version_id;
END;
$$;

CREATE OR REPLACE FUNCTION playbook_create_ai_proposals(
  p_workspace_id uuid,
  p_actor_id uuid,
  p_model text,
  p_proposals jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_item jsonb;
  v_snapshot jsonb;
  v_evidence_ids uuid[];
  v_procedure_id uuid;
  v_role_id uuid;
  v_snapshot_role_id uuid;
  v_snapshot_person_id uuid;
  v_proposal_id uuid;
  v_evidence_count integer;
  v_result jsonb := '[]'::jsonb;
BEGIN
  IF jsonb_typeof(p_proposals) <> 'array' OR jsonb_array_length(p_proposals) NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'playbook_invalid_proposal_batch';
  END IF;
  IF char_length(trim(coalesce(p_model, ''))) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'playbook_invalid_model'; END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_proposals) LOOP
    v_snapshot := v_item->'proposed_snapshot';
    IF NOT public.playbook_snapshot_is_valid(v_snapshot) THEN RAISE EXCEPTION 'playbook_invalid_snapshot'; END IF;
    v_procedure_id := nullif(v_item->>'procedure_id', '')::uuid;
    v_role_id := nullif(v_item->>'suggested_role_id', '')::uuid;
    v_snapshot_role_id := nullif(v_snapshot->>'responsible_role_id', '')::uuid;
    v_snapshot_person_id := nullif(v_snapshot->>'assigned_person_id', '')::uuid;
    IF (v_item->>'proposal_kind') NOT IN ('new_procedure', 'change_procedure') THEN RAISE EXCEPTION 'playbook_invalid_kind'; END IF;
    IF (v_item->>'priority') NOT IN ('high', 'medium', 'low') THEN RAISE EXCEPTION 'playbook_invalid_priority'; END IF;
    IF (v_item->>'proposal_kind') = 'change_procedure' AND (
      v_procedure_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.playbook_procedures WHERE workspace_id = p_workspace_id AND id = v_procedure_id
      )
    ) THEN RAISE EXCEPTION 'playbook_invalid_procedure'; END IF;
    IF (v_item->>'proposal_kind') = 'new_procedure' AND v_procedure_id IS NOT NULL THEN
      RAISE EXCEPTION 'playbook_new_procedure_has_existing_id';
    END IF;
    IF v_role_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.playbook_roles WHERE workspace_id = p_workspace_id AND id = v_role_id AND active
    ) THEN RAISE EXCEPTION 'playbook_invalid_role'; END IF;
    IF v_snapshot_role_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.playbook_roles WHERE workspace_id = p_workspace_id AND id = v_snapshot_role_id AND active
    ) THEN RAISE EXCEPTION 'playbook_invalid_role'; END IF;
    IF v_snapshot_person_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.playbook_people WHERE workspace_id = p_workspace_id AND id = v_snapshot_person_id AND active
    ) THEN RAISE EXCEPTION 'playbook_invalid_person'; END IF;

    IF jsonb_typeof(v_item->'evidence_ids') <> 'array' THEN
      RAISE EXCEPTION 'playbook_invalid_evidence';
    END IF;
    SELECT array_agg(DISTINCT evidence.value::uuid ORDER BY evidence.value::uuid)
    INTO v_evidence_ids
    FROM jsonb_array_elements_text(v_item->'evidence_ids') AS evidence(value);
    IF coalesce(cardinality(v_evidence_ids), 0) < 2 OR cardinality(v_evidence_ids) > 20 THEN
      RAISE EXCEPTION 'playbook_insufficient_evidence';
    END IF;
    SELECT count(DISTINCT review.id)::integer INTO v_evidence_count
    FROM public.reviews AS review
    JOIN public.restaurants AS restaurant ON restaurant.id = review.restaurant_id
    WHERE restaurant.workspace_id = p_workspace_id
      AND review.id = ANY(v_evidence_ids);
    IF v_evidence_count <> cardinality(v_evidence_ids) THEN RAISE EXCEPTION 'playbook_unauthorized_evidence'; END IF;

    INSERT INTO public.playbook_change_proposals (
      workspace_id, procedure_id, proposal_kind, problem, proposed_snapshot,
      expected_benefit, priority, rationale, suggested_role_id, model, created_by
    ) VALUES (
      p_workspace_id, v_procedure_id, v_item->>'proposal_kind', trim(v_item->>'problem'), v_snapshot,
      trim(v_item->>'expected_benefit'), v_item->>'priority', trim(v_item->>'rationale'),
      v_role_id, trim(p_model), p_actor_id
    ) RETURNING id INTO v_proposal_id;

    INSERT INTO public.playbook_proposal_evidence (workspace_id, proposal_id, restaurant_id, review_id)
    SELECT p_workspace_id, v_proposal_id, review.restaurant_id, review.id
    FROM public.reviews AS review
    JOIN public.restaurants AS restaurant ON restaurant.id = review.restaurant_id
    WHERE restaurant.workspace_id = p_workspace_id AND review.id = ANY(v_evidence_ids);

    v_result := v_result || jsonb_build_array(v_proposal_id);
  END LOOP;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION playbook_review_proposal(
  p_workspace_id uuid,
  p_proposal_id uuid,
  p_expected_lock_version integer,
  p_actor_id uuid,
  p_action text,
  p_edits jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_current public.playbook_change_proposals%ROWTYPE;
  v_snapshot jsonb;
  v_role_id uuid;
  v_snapshot_role_id uuid;
  v_snapshot_person_id uuid;
BEGIN
  SELECT * INTO v_current FROM public.playbook_change_proposals
  WHERE workspace_id = p_workspace_id AND id = p_proposal_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'playbook_proposal_not_found'; END IF;
  IF v_current.lock_version <> p_expected_lock_version THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'playbook_proposal_conflict';
  END IF;

  IF p_action = 'edit' THEN
    IF v_current.status <> 'pending' THEN RAISE EXCEPTION 'playbook_proposal_not_editable'; END IF;
    IF p_edits IS NULL OR jsonb_typeof(p_edits) <> 'object' THEN
      RAISE EXCEPTION 'playbook_invalid_edits';
    END IF;
    v_snapshot := coalesce(p_edits->'proposed_snapshot', v_current.proposed_snapshot);
    IF NOT public.playbook_snapshot_is_valid(v_snapshot) THEN RAISE EXCEPTION 'playbook_invalid_snapshot'; END IF;
    v_snapshot_role_id := nullif(v_snapshot->>'responsible_role_id', '')::uuid;
    v_snapshot_person_id := nullif(v_snapshot->>'assigned_person_id', '')::uuid;
    v_role_id := CASE
      WHEN p_edits ? 'suggested_role_id' THEN nullif(p_edits->>'suggested_role_id', '')::uuid
      ELSE v_current.suggested_role_id
    END;
    IF p_edits ? 'priority' AND coalesce(p_edits->>'priority', '') NOT IN ('high', 'medium', 'low') THEN
      RAISE EXCEPTION 'playbook_invalid_priority';
    END IF;
    IF v_role_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.playbook_roles WHERE workspace_id = p_workspace_id AND id = v_role_id AND active
    ) THEN RAISE EXCEPTION 'playbook_invalid_role'; END IF;
    IF v_snapshot_role_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.playbook_roles
      WHERE workspace_id = p_workspace_id AND id = v_snapshot_role_id AND active
    ) THEN RAISE EXCEPTION 'playbook_invalid_role'; END IF;
    IF v_snapshot_person_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.playbook_people
      WHERE workspace_id = p_workspace_id AND id = v_snapshot_person_id AND active
    ) THEN RAISE EXCEPTION 'playbook_invalid_person'; END IF;
    UPDATE public.playbook_change_proposals SET
      problem = coalesce(nullif(trim(p_edits->>'problem'), ''), problem),
      proposed_snapshot = v_snapshot,
      expected_benefit = coalesce(nullif(trim(p_edits->>'expected_benefit'), ''), expected_benefit),
      priority = coalesce(nullif(p_edits->>'priority', ''), priority),
      rationale = coalesce(nullif(trim(p_edits->>'rationale'), ''), rationale),
      suggested_role_id = v_role_id,
      edited_by = p_actor_id,
      lock_version = lock_version + 1
    WHERE id = p_proposal_id;
  ELSIF p_action = 'approve' THEN
    IF v_current.status <> 'pending' THEN RAISE EXCEPTION 'playbook_proposal_not_pending'; END IF;
    UPDATE public.playbook_change_proposals SET
      status = 'approved', approved_by = p_actor_id, approved_at = now(),
      rejected_by = NULL, rejected_at = NULL, lock_version = lock_version + 1
    WHERE id = p_proposal_id;
  ELSIF p_action = 'reject' THEN
    IF v_current.status NOT IN ('pending', 'approved') THEN RAISE EXCEPTION 'playbook_proposal_not_reviewable'; END IF;
    UPDATE public.playbook_change_proposals SET
      status = 'rejected', rejected_by = p_actor_id, rejected_at = now(),
      lock_version = lock_version + 1
    WHERE id = p_proposal_id;
  ELSE
    RAISE EXCEPTION 'playbook_invalid_review_action';
  END IF;
  RETURN p_proposal_id;
END;
$$;

CREATE OR REPLACE FUNCTION playbook_apply_proposal(
  p_workspace_id uuid,
  p_proposal_id uuid,
  p_expected_proposal_lock_version integer,
  p_expected_procedure_lock_version integer,
  p_actor_id uuid,
  p_change_summary text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_proposal public.playbook_change_proposals%ROWTYPE;
  v_current public.playbook_procedures%ROWTYPE;
  v_snapshot jsonb;
  v_role_id uuid;
  v_person_id uuid;
  v_procedure_id uuid;
  v_version_id uuid;
  v_next_version integer;
BEGIN
  SELECT * INTO v_proposal FROM public.playbook_change_proposals
  WHERE workspace_id = p_workspace_id AND id = p_proposal_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'playbook_proposal_not_found'; END IF;
  IF v_proposal.status = 'applied' THEN
    RETURN jsonb_build_object('procedure_id', v_proposal.procedure_id, 'version_id', v_proposal.applied_version_id, 'already_applied', true);
  END IF;
  IF v_proposal.lock_version <> p_expected_proposal_lock_version THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'playbook_proposal_conflict';
  END IF;
  IF v_proposal.status <> 'approved' THEN RAISE EXCEPTION 'playbook_proposal_not_approved'; END IF;
  IF v_proposal.approved_by IS NULL OR v_proposal.approved_at IS NULL THEN
    RAISE EXCEPTION 'playbook_proposal_missing_approval_audit';
  END IF;
  IF char_length(trim(coalesce(p_change_summary, ''))) NOT BETWEEN 3 AND 1000 THEN
    RAISE EXCEPTION 'playbook_invalid_change_summary';
  END IF;

  v_snapshot := jsonb_set(v_proposal.proposed_snapshot, '{status}', '"active"'::jsonb, true);
  IF NOT public.playbook_snapshot_is_valid(v_snapshot) THEN RAISE EXCEPTION 'playbook_invalid_snapshot'; END IF;
  v_role_id := nullif(v_snapshot->>'responsible_role_id', '')::uuid;
  v_person_id := nullif(v_snapshot->>'assigned_person_id', '')::uuid;
  IF v_role_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.playbook_roles WHERE workspace_id = p_workspace_id AND id = v_role_id AND active
  ) THEN RAISE EXCEPTION 'playbook_invalid_role'; END IF;
  IF v_person_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.playbook_people WHERE workspace_id = p_workspace_id AND id = v_person_id AND active
  ) THEN RAISE EXCEPTION 'playbook_invalid_person'; END IF;

  IF v_proposal.procedure_id IS NULL THEN
    INSERT INTO public.playbook_procedures (
      workspace_id, title, category, description, objective, steps,
      responsible_role_id, assigned_person_id, status, created_by, updated_by
    ) VALUES (
      p_workspace_id, trim(v_snapshot->>'title'), v_snapshot->>'category',
      coalesce(v_snapshot->>'description', ''), coalesce(v_snapshot->>'objective', ''), v_snapshot->'steps',
      v_role_id, v_person_id, 'active', p_actor_id, p_actor_id
    ) RETURNING id INTO v_procedure_id;
    v_next_version := 1;
  ELSE
    SELECT * INTO v_current FROM public.playbook_procedures
    WHERE workspace_id = p_workspace_id AND id = v_proposal.procedure_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'playbook_procedure_not_found'; END IF;
    IF v_current.lock_version <> p_expected_procedure_lock_version THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'playbook_procedure_conflict';
    END IF;
    v_procedure_id := v_current.id;
    v_next_version := v_current.current_version + 1;
    UPDATE public.playbook_procedures SET
      title = trim(v_snapshot->>'title'), category = v_snapshot->>'category',
      description = coalesce(v_snapshot->>'description', ''), objective = coalesce(v_snapshot->>'objective', ''),
      steps = v_snapshot->'steps', responsible_role_id = v_role_id,
      assigned_person_id = v_person_id, status = 'active', current_version = v_next_version,
      lock_version = lock_version + 1, updated_by = p_actor_id
    WHERE id = v_procedure_id;
  END IF;

  INSERT INTO public.playbook_versions (
    workspace_id, procedure_id, version_number, snapshot, change_summary,
    source, source_proposal_id, created_by, approved_by
  ) VALUES (
    p_workspace_id, v_procedure_id, v_next_version, v_snapshot, trim(p_change_summary),
    'ai_proposal', v_proposal.id, p_actor_id, v_proposal.approved_by
  ) RETURNING id INTO v_version_id;

  UPDATE public.playbook_change_proposals SET
    procedure_id = v_procedure_id, status = 'applied', applied_version_id = v_version_id,
    lock_version = lock_version + 1
  WHERE id = v_proposal.id;

  RETURN jsonb_build_object('procedure_id', v_procedure_id, 'version_id', v_version_id, 'already_applied', false);
END;
$$;

-- Owners may read only their own workspace data. Mutations remain server-only
-- and require an authenticated, verified session plus route-level ownership.
ALTER TABLE playbook_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_change_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_proposal_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_tasks ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'playbook_roles', 'playbook_people', 'playbook_procedures', 'playbook_versions',
    'playbook_change_proposals', 'playbook_proposal_evidence', 'playbook_tasks'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "workspace owner select" ON public.%I', v_table);
    EXECUTE format(
      'CREATE POLICY "workspace owner select" ON public.%I FOR SELECT TO authenticated USING (public.current_user_owns_replova_workspace(workspace_id))',
      v_table
    );
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', v_table);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', v_table);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', v_table);
  END LOOP;
END $$;

-- Revoke from every application role, including service_role, before granting
-- back the minimum executable surface. The surrounding migration transaction
-- prevents any observable PUBLIC-execute window or partially granted state.
REVOKE ALL ON FUNCTION public.playbook_snapshot_is_valid(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_playbook_updated_at() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.playbook_reserve_ai_run(text, timestamptz, integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.playbook_create_procedure(uuid, uuid, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.playbook_update_procedure(uuid, uuid, integer, uuid, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.playbook_create_ai_proposals(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.playbook_review_proposal(uuid, uuid, integer, uuid, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.playbook_apply_proposal(uuid, uuid, integer, integer, uuid, text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.playbook_snapshot_is_valid(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.playbook_reserve_ai_run(text, timestamptz, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.playbook_create_procedure(uuid, uuid, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.playbook_update_procedure(uuid, uuid, integer, uuid, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.playbook_create_ai_proposals(uuid, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.playbook_review_proposal(uuid, uuid, integer, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.playbook_apply_proposal(uuid, uuid, integer, integer, uuid, text) TO service_role;

COMMENT ON TABLE playbook_people IS
  'Workspace staff directory only. Rows are not Supabase Auth users and create no login or invitation.';
COMMENT ON TABLE playbook_proposal_evidence IS
  'Evidence links validated against reviews belonging to a location in the same workspace.';
COMMENT ON TABLE playbook_tasks IS
  'Durable Playbook improvement tasks; separate from browser-local synthetic Feedback Demo tasks.';
