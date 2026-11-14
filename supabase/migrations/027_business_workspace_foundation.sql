-- Phase 6A: business-first account and workspace foundation.
--
-- This migration is intentionally independent of the parked migration 026.
-- It requires only the schema through migration 025 and must be reviewed and
-- applied manually. Applying this migration does NOT run the legacy backfill.

-- ---------------------------------------------------------------------------
-- Stable account identity
-- ---------------------------------------------------------------------------

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounts_auth_user_id_fkey'
      AND conrelid = 'accounts'::regclass
  ) THEN
    ALTER TABLE accounts
      ADD CONSTRAINT accounts_auth_user_id_fkey
      FOREIGN KEY (auth_user_id)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS accounts_auth_user_id_unique
  ON accounts (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

COMMENT ON COLUMN accounts.auth_user_id IS
  'Stable Supabase Auth owner identifier. Nullable during the email-compatibility migration period.';

-- A linked auth identity must belong to the same normalized email as the
-- legacy owner_email. This prevents a server-side bug from transferring an
-- account to an unrelated auth user while owner_email remains authoritative.
CREATE OR REPLACE FUNCTION validate_replova_account_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.auth_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM auth.users AS auth_user
    WHERE auth_user.id = NEW.auth_user_id
      AND lower(trim(auth_user.email)) = lower(trim(NEW.owner_email))
  ) THEN
    RAISE EXCEPTION 'account_auth_user_email_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accounts_validate_auth_user ON accounts;
CREATE TRIGGER accounts_validate_auth_user
BEFORE INSERT OR UPDATE OF auth_user_id, owner_email ON accounts
FOR EACH ROW EXECUTE FUNCTION validate_replova_account_auth_user();

-- ---------------------------------------------------------------------------
-- Business workspaces and legacy location compatibility
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS business_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  provisioning_source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_workspaces_name_length
    CHECK (char_length(trim(name)) BETWEEN 1 AND 200),
  CONSTRAINT business_workspaces_status
    CHECK (status IN ('active', 'archived')),
  CONSTRAINT business_workspaces_provisioning_source
    CHECK (provisioning_source IN ('manual', 'legacy_backfill', 'system'))
);

CREATE INDEX IF NOT EXISTS business_workspaces_account_id_idx
  ON business_workspaces (account_id, created_at, id);

-- At most one migration-created workspace may exist for an account. Accounts
-- may still have multiple manually provisioned workspaces in a later phase.
CREATE UNIQUE INDEX IF NOT EXISTS business_workspaces_legacy_account_unique
  ON business_workspaces (account_id)
  WHERE provisioning_source = 'legacy_backfill';

CREATE OR REPLACE FUNCTION set_replova_workspace_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_workspaces_updated_at ON business_workspaces;
CREATE TRIGGER business_workspaces_updated_at
BEFORE UPDATE ON business_workspaces
FOR EACH ROW EXECUTE FUNCTION set_replova_workspace_updated_at();

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS workspace_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurants_workspace_id_fkey'
      AND conrelid = 'restaurants'::regclass
  ) THEN
    ALTER TABLE restaurants
      ADD CONSTRAINT restaurants_workspace_id_fkey
      FOREIGN KEY (workspace_id)
      REFERENCES business_workspaces(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS restaurants_workspace_id_idx
  ON restaurants (workspace_id, created_at, id);

-- A workspace can exist without a location, and a legacy location no longer
-- needs a Google Places identifier. The existing UNIQUE constraint remains:
-- PostgreSQL permits multiple NULL values while still de-duplicating real IDs.
ALTER TABLE restaurants
  ALTER COLUMN place_id DROP NOT NULL;

COMMENT ON TABLE business_workspaces IS
  'Durable business container owned by an account and independent of Google Places, Google Business Profile, and YouTube.';
COMMENT ON COLUMN restaurants.workspace_id IS
  'Nullable Phase 6A link from a legacy-named location record to its business workspace.';
COMMENT ON COLUMN restaurants.place_id IS
  'Optional Google Places identifier. NULL supports account-first setup and locations without a Places listing.';

-- During the compatibility period, a location may only be attached to a
-- workspace whose account has the same normalized legacy owner email.
CREATE OR REPLACE FUNCTION validate_replova_restaurant_workspace_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.workspace_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM business_workspaces AS workspace
    JOIN accounts AS account ON account.id = workspace.account_id
    WHERE workspace.id = NEW.workspace_id
      AND lower(trim(account.owner_email)) = lower(trim(NEW.owner_email))
  ) THEN
    RAISE EXCEPTION 'restaurant_workspace_owner_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restaurants_validate_workspace_owner ON restaurants;
CREATE TRIGGER restaurants_validate_workspace_owner
BEFORE INSERT OR UPDATE OF workspace_id, owner_email ON restaurants
FOR EACH ROW EXECUTE FUNCTION validate_replova_restaurant_workspace_owner();

-- ---------------------------------------------------------------------------
-- Ownership helpers and defensive RLS
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION current_user_owns_replova_account(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM accounts AS account
    WHERE account.id = p_account_id
      AND (
        account.auth_user_id = auth.uid()
        OR (
          account.auth_user_id IS NULL
          AND auth.uid() IS NOT NULL
          AND lower(trim(account.owner_email)) = lower(trim(auth.email()))
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION current_user_owns_replova_workspace(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM business_workspaces AS workspace
    WHERE workspace.id = p_workspace_id
      AND current_user_owns_replova_account(workspace.account_id)
  );
$$;

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account owner select" ON accounts;
CREATE POLICY "account owner select"
  ON accounts FOR SELECT
  TO authenticated
  USING (current_user_owns_replova_account(id));

DROP POLICY IF EXISTS "workspace owner select" ON business_workspaces;
CREATE POLICY "workspace owner select"
  ON business_workspaces FOR SELECT
  TO authenticated
  USING (current_user_owns_replova_account(account_id));

-- Authenticated clients may read only their own account/workspace rows. All
-- writes, including auth_user_id and ownership changes, remain server-only.
REVOKE ALL ON TABLE accounts FROM anon, authenticated;
REVOKE ALL ON TABLE business_workspaces FROM anon, authenticated;
GRANT SELECT ON TABLE accounts TO authenticated;
GRANT SELECT ON TABLE business_workspaces TO authenticated;
GRANT ALL ON TABLE accounts TO service_role;
GRANT ALL ON TABLE business_workspaces TO service_role;

-- ---------------------------------------------------------------------------
-- Manual, auditable legacy backfill
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS phase6a_backfill_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_by text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT phase6a_backfill_runs_actor_length
    CHECK (char_length(trim(executed_by)) BETWEEN 1 AND 200),
  CONSTRAINT phase6a_backfill_runs_status
    CHECK (status IN ('running', 'completed', 'failed')),
  CONSTRAINT phase6a_backfill_runs_error_length
    CHECK (error_message IS NULL OR char_length(error_message) <= 1000)
);

CREATE TABLE IF NOT EXISTS phase6a_backfill_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES phase6a_backfill_runs(id) ON DELETE RESTRICT,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT phase6a_backfill_events_entity_type
    CHECK (entity_type IN ('account', 'workspace', 'restaurant')),
  CONSTRAINT phase6a_backfill_events_action_length
    CHECK (char_length(trim(action)) BETWEEN 1 AND 100),
  CONSTRAINT phase6a_backfill_events_run_entity_action_unique
    UNIQUE (run_id, entity_type, entity_id, action)
);

CREATE INDEX IF NOT EXISTS phase6a_backfill_events_run_idx
  ON phase6a_backfill_events (run_id, created_at, id);

ALTER TABLE phase6a_backfill_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase6a_backfill_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE phase6a_backfill_runs IS
  'Server-only audit record for explicit Phase 6A backfill executions. Migration 027 never calls the backfill.';
COMMENT ON TABLE phase6a_backfill_events IS
  'Append-only identifiers and changed relationship fields for each successful Phase 6A backfill mutation; excludes emails and business names.';

-- Read-only preview. It changes no rows and records no run.
CREATE OR REPLACE FUNCTION preview_phase6a_workspace_backfill()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH account_email_groups AS (
    SELECT
      lower(trim(account.owner_email)) AS normalized_email,
      count(*) AS account_count,
      (array_agg(account.id ORDER BY account.created_at, account.id))[1] AS account_id
    FROM accounts AS account
    GROUP BY lower(trim(account.owner_email))
  ), auth_email_groups AS (
    SELECT
      lower(trim(auth_user.email)) AS normalized_email,
      count(*) AS auth_user_count,
      (array_agg(auth_user.id ORDER BY auth_user.created_at, auth_user.id))[1] AS auth_user_id
    FROM auth.users AS auth_user
    WHERE auth_user.email IS NOT NULL
    GROUP BY lower(trim(auth_user.email))
  ), unlinked_account_identities AS (
    SELECT
      account.id AS account_id,
      account_group.normalized_email,
      account_group.account_count,
      coalesce(auth_group.auth_user_count, 0) AS auth_user_count,
      auth_group.auth_user_id,
      coalesce(EXISTS (
        SELECT 1
        FROM accounts AS linked_account
        WHERE linked_account.auth_user_id = auth_group.auth_user_id
          AND linked_account.id <> account.id
      ), false) AS auth_user_claimed
    FROM accounts AS account
    JOIN account_email_groups AS account_group
      ON account_group.normalized_email = lower(trim(account.owner_email))
    LEFT JOIN auth_email_groups AS auth_group
      ON auth_group.normalized_email = account_group.normalized_email
    WHERE account.auth_user_id IS NULL
  ), workspace_counts AS (
    SELECT account.id AS account_id, count(workspace.id) AS workspace_count
    FROM accounts AS account
    LEFT JOIN business_workspaces AS workspace ON workspace.account_id = account.id
    GROUP BY account.id
  ), location_candidates AS (
    SELECT
      restaurant.id,
      coalesce(account_group.account_count, 0) AS account_count,
      account_group.account_id,
      coalesce(workspace_counts.workspace_count, 0) AS workspace_count
    FROM restaurants AS restaurant
    LEFT JOIN account_email_groups AS account_group
      ON account_group.normalized_email = lower(trim(restaurant.owner_email))
    LEFT JOIN workspace_counts
      ON workspace_counts.account_id = account_group.account_id
      AND account_group.account_count = 1
    WHERE restaurant.workspace_id IS NULL
  )
  SELECT jsonb_build_object(
    'accounts_total', (SELECT count(*) FROM accounts),
    'account_auth_links_ready', (
      SELECT count(*)
      FROM unlinked_account_identities
      WHERE account_count = 1
        AND auth_user_count = 1
        AND auth_user_claimed = false
    ),
    'account_auth_links_unresolved', (
      SELECT count(*)
      FROM unlinked_account_identities
      WHERE account_count = 1 AND auth_user_count = 0
    ),
    'account_auth_link_conflicts', (
      SELECT count(*)
      FROM unlinked_account_identities
      WHERE account_count > 1
        OR auth_user_count > 1
        OR (account_count = 1 AND auth_user_count = 1 AND auth_user_claimed = true)
    ),
    'duplicate_account_email_groups', (
      SELECT count(*) FROM account_email_groups WHERE account_count > 1
    ),
    'duplicate_account_email_accounts', (
      SELECT coalesce(sum(account_count), 0)
      FROM account_email_groups
      WHERE account_count > 1
    ),
    'duplicate_auth_email_groups', (
      SELECT count(DISTINCT normalized_email)
      FROM unlinked_account_identities
      WHERE auth_user_count > 1
    ),
    'duplicate_auth_email_accounts', (
      SELECT count(*)
      FROM unlinked_account_identities
      WHERE auth_user_count > 1
    ),
    'auth_user_already_claimed_conflicts', (
      SELECT count(*)
      FROM unlinked_account_identities
      WHERE account_count = 1
        AND auth_user_count = 1
        AND auth_user_claimed = true
    ),
    'workspaces_to_create', (
      SELECT count(*) FROM workspace_counts WHERE workspace_count = 0
    ),
    'locations_to_link', (
      SELECT count(*)
      FROM location_candidates
      WHERE account_count = 1 AND workspace_count <= 1
    ),
    'orphan_locations', (
      SELECT count(*) FROM location_candidates WHERE account_count = 0
    ),
    'ambiguous_account_locations', (
      SELECT count(*) FROM location_candidates WHERE account_count > 1
    ),
    'ambiguous_workspace_locations', (
      SELECT count(*)
      FROM location_candidates
      WHERE account_count = 1 AND workspace_count > 1
    )
  );
$$;

-- Explicit execution entry point. It is not called by this migration and only
-- service_role can execute it. The function is idempotent: it links only NULL
-- fields, creates a workspace only when an account has none, and skips any
-- location whose account has multiple workspaces because ownership is ambiguous.
CREATE OR REPLACE FUNCTION run_phase6a_workspace_backfill(p_executed_by text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_run_id uuid;
  v_account_id uuid;
  v_auth_user_id uuid;
  v_workspace_id uuid;
  v_restaurant_id uuid;
  v_workspace_name text;
  v_summary jsonb;
  v_error_message text;
BEGIN
  IF p_executed_by IS NULL OR char_length(trim(p_executed_by)) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'phase6a_backfill_actor_required';
  END IF;

  -- Prevent two operators from running this backfill concurrently.
  PERFORM pg_advisory_xact_lock(hashtextextended('replova_phase6a_workspace_backfill', 0));

  INSERT INTO phase6a_backfill_runs (executed_by)
  VALUES (trim(p_executed_by))
  RETURNING id INTO v_run_id;

  BEGIN
    -- Link only normalized-email groups containing exactly one account and
    -- exactly one auth user. Existing auth_user_id values win. Duplicate
    -- account or auth identities are omitted rather than allowed to race for
    -- the partial unique index.
    FOR v_account_id, v_auth_user_id IN
      WITH unique_account_emails AS (
        SELECT
          lower(trim(account.owner_email)) AS normalized_email,
          (array_agg(account.id ORDER BY account.created_at, account.id))[1] AS account_id
        FROM accounts AS account
        GROUP BY lower(trim(account.owner_email))
        HAVING count(*) = 1
      ), unique_auth_emails AS (
        SELECT
          lower(trim(auth_user.email)) AS normalized_email,
          (array_agg(auth_user.id ORDER BY auth_user.created_at, auth_user.id))[1] AS auth_user_id
        FROM auth.users AS auth_user
        WHERE auth_user.email IS NOT NULL
        GROUP BY lower(trim(auth_user.email))
        HAVING count(*) = 1
      )
      SELECT account.id, auth_group.auth_user_id
      FROM accounts AS account
      JOIN unique_account_emails AS account_group ON account_group.account_id = account.id
      JOIN unique_auth_emails AS auth_group
        ON auth_group.normalized_email = account_group.normalized_email
      WHERE account.auth_user_id IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM accounts AS linked_account
          WHERE linked_account.auth_user_id = auth_group.auth_user_id
            AND linked_account.id <> account.id
        )
      ORDER BY account.created_at, account.id
      FOR UPDATE OF account
    LOOP
      BEGIN
        UPDATE accounts AS target_account
        SET auth_user_id = v_auth_user_id
        WHERE target_account.id = v_account_id
          AND target_account.auth_user_id IS NULL
          AND 1 = (
            SELECT count(*)
            FROM accounts AS same_email_account
            WHERE lower(trim(same_email_account.owner_email)) = lower(trim(target_account.owner_email))
          )
          AND 1 = (
            SELECT count(*)
            FROM auth.users AS same_email_auth_user
            WHERE lower(trim(same_email_auth_user.email)) = lower(trim(target_account.owner_email))
          )
          AND NOT EXISTS (
            SELECT 1
            FROM accounts AS linked_account
            WHERE linked_account.auth_user_id = v_auth_user_id
              AND linked_account.id <> target_account.id
          );
      EXCEPTION WHEN unique_violation THEN
        -- A concurrent server-side owner link won the race. Preserve both
        -- records and continue processing independent identities.
        CONTINUE;
      END;

      IF FOUND THEN
        INSERT INTO phase6a_backfill_events (
          run_id, entity_type, entity_id, action, before_state, after_state
        ) VALUES (
          v_run_id,
          'account',
          v_account_id,
          'auth_user_linked',
          jsonb_build_object('auth_user_id', NULL),
          jsonb_build_object('auth_user_id', v_auth_user_id)
        );
      END IF;
    END LOOP;

    -- Create one compatibility workspace only for accounts that currently
    -- have no workspace. The first legacy location name is a reversible label,
    -- not an ownership key; accounts without locations receive a neutral name.
    FOR v_account_id IN
      SELECT account.id
      FROM accounts AS account
      WHERE NOT EXISTS (
        SELECT 1 FROM business_workspaces AS workspace
        WHERE workspace.account_id = account.id
      )
      ORDER BY account.created_at, account.id
      FOR UPDATE OF account
    LOOP
      SELECT left(coalesce(nullif(trim(restaurant.name), ''), 'Business workspace'), 200)
      INTO v_workspace_name
      FROM restaurants AS restaurant
      JOIN accounts AS account ON account.id = v_account_id
      WHERE lower(trim(restaurant.owner_email)) = lower(trim(account.owner_email))
      ORDER BY restaurant.created_at, restaurant.id
      LIMIT 1;

      v_workspace_name := coalesce(v_workspace_name, 'Business workspace');

      INSERT INTO business_workspaces (account_id, name, provisioning_source)
      VALUES (v_account_id, v_workspace_name, 'legacy_backfill')
      RETURNING id INTO v_workspace_id;

      INSERT INTO phase6a_backfill_events (
        run_id, entity_type, entity_id, action, before_state, after_state
      ) VALUES (
        v_run_id,
        'workspace',
        v_workspace_id,
        'workspace_created',
        '{}'::jsonb,
        jsonb_build_object(
          'account_id', v_account_id,
          'provisioning_source', 'legacy_backfill'
        )
      );
    END LOOP;

    -- Attach a legacy location only when its normalized email resolves to one
    -- account and that account resolves to exactly one workspace.
    FOR v_restaurant_id, v_workspace_id IN
      WITH unique_account_emails AS (
        SELECT
          lower(trim(account.owner_email)) AS normalized_email,
          (array_agg(account.id ORDER BY account.created_at, account.id))[1] AS account_id
        FROM accounts AS account
        GROUP BY lower(trim(account.owner_email))
        HAVING count(*) = 1
      ), single_account_workspaces AS (
        SELECT
          workspace.account_id,
          (array_agg(workspace.id ORDER BY workspace.created_at, workspace.id))[1] AS workspace_id
        FROM business_workspaces AS workspace
        GROUP BY workspace.account_id
        HAVING count(*) = 1
      )
      SELECT restaurant.id, account_workspace.workspace_id
      FROM restaurants AS restaurant
      JOIN unique_account_emails AS account_group
        ON account_group.normalized_email = lower(trim(restaurant.owner_email))
      JOIN single_account_workspaces AS account_workspace
        ON account_workspace.account_id = account_group.account_id
      WHERE restaurant.workspace_id IS NULL
      ORDER BY restaurant.id
    LOOP
      UPDATE restaurants AS target_restaurant
      SET workspace_id = v_workspace_id
      WHERE target_restaurant.id = v_restaurant_id
        AND target_restaurant.workspace_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM business_workspaces AS chosen_workspace
          JOIN accounts AS owner_account ON owner_account.id = chosen_workspace.account_id
          WHERE chosen_workspace.id = v_workspace_id
            AND lower(trim(owner_account.owner_email)) = lower(trim(target_restaurant.owner_email))
            AND 1 = (
              SELECT count(*)
              FROM accounts AS same_email_account
              WHERE lower(trim(same_email_account.owner_email)) = lower(trim(target_restaurant.owner_email))
            )
            AND 1 = (
              SELECT count(*)
              FROM business_workspaces AS account_workspace
              WHERE account_workspace.account_id = owner_account.id
            )
        );

      IF FOUND THEN
        INSERT INTO phase6a_backfill_events (
          run_id, entity_type, entity_id, action, before_state, after_state
        ) VALUES (
          v_run_id,
          'restaurant',
          v_restaurant_id,
          'workspace_linked',
          jsonb_build_object('workspace_id', NULL),
          jsonb_build_object('workspace_id', v_workspace_id)
        );
      END IF;
    END LOOP;

    SELECT jsonb_build_object(
      'auth_users_linked', count(*) FILTER (WHERE action = 'auth_user_linked'),
      'workspaces_created', count(*) FILTER (WHERE action = 'workspace_created'),
      'locations_linked', count(*) FILTER (WHERE action = 'workspace_linked'),
      'remaining_preview', preview_phase6a_workspace_backfill()
    )
    INTO v_summary
    FROM phase6a_backfill_events
    WHERE run_id = v_run_id;

    UPDATE phase6a_backfill_runs
    SET
      status = 'completed',
      summary = v_summary,
      completed_at = now()
    WHERE id = v_run_id;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;

    UPDATE phase6a_backfill_runs
    SET
      status = 'failed',
      error_message = left(v_error_message, 1000),
      completed_at = now()
    WHERE id = v_run_id;

    RETURN jsonb_build_object(
      'run_id', v_run_id,
      'status', 'failed',
      'error', left(v_error_message, 1000)
    );
  END;

  RETURN jsonb_build_object(
    'run_id', v_run_id,
    'status', 'completed',
    'summary', v_summary
  );
END;
$$;

-- Audit rows are intentionally not client-visible or directly mutable by the
-- service role. Operators use the preview/run RPCs and may SELECT the audit.
REVOKE ALL ON TABLE phase6a_backfill_runs FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE phase6a_backfill_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE phase6a_backfill_runs TO service_role;
GRANT SELECT ON TABLE phase6a_backfill_events TO service_role;

REVOKE ALL ON FUNCTION validate_replova_account_auth_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION set_replova_workspace_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION validate_replova_restaurant_workspace_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION current_user_owns_replova_account(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION current_user_owns_replova_workspace(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION preview_phase6a_workspace_backfill() FROM PUBLIC;
REVOKE ALL ON FUNCTION run_phase6a_workspace_backfill(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION current_user_owns_replova_account(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION current_user_owns_replova_workspace(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION preview_phase6a_workspace_backfill() TO service_role;
GRANT EXECUTE ON FUNCTION run_phase6a_workspace_backfill(text) TO service_role;

-- Deliberately absent:
--   SELECT run_phase6a_workspace_backfill(...);
-- Review preview_phase6a_workspace_backfill() output before running it manually.
