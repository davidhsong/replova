-- Phase 6B: atomic account-first onboarding.
--
-- Apply manually after migration 027. This migration is independent of the
-- parked migration 026. It creates no accounts, workspaces, locations, Places
-- records, OAuth connections, or backfill work during schema application.

-- A new account gets at most one system-provisioned initial workspace. Existing
-- legacy/manual workspaces remain unchanged and continue to allow later product
-- support for multiple workspaces per account.
CREATE UNIQUE INDEX IF NOT EXISTS business_workspaces_initial_account_unique
  ON business_workspaces (account_id)
  WHERE provisioning_source = 'system';

COMMENT ON INDEX business_workspaces_initial_account_unique IS
  'Prevents duplicate initial workspaces during retried or concurrent Phase 6B onboarding requests.';

CREATE OR REPLACE FUNCTION provision_replova_account_workspace(
  p_auth_user_id uuid,
  p_verified_email text,
  p_workspace_name text,
  -- Growth is Replova's existing onboarding trial tier. Only the service-role
  -- caller may supply this value; paid entitlement still comes from Stripe.
  p_plan text DEFAULT 'growth'
)
RETURNS TABLE (
  account_id uuid,
  workspace_id uuid,
  account_created boolean,
  workspace_created boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_email text;
  v_account_id uuid;
  v_account_auth_user_id uuid;
  v_workspace_id uuid;
  v_matching_account_count bigint;
  v_matching_auth_count bigint;
  v_account_created boolean := false;
  v_workspace_created boolean := false;
BEGIN
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'authenticated_user_required';
  END IF;

  IF p_verified_email IS NULL
    OR char_length(trim(p_verified_email)) < 3
    OR char_length(trim(p_verified_email)) > 320 THEN
    RAISE EXCEPTION 'verified_email_required';
  END IF;

  IF p_workspace_name IS NULL
    OR char_length(trim(p_workspace_name)) < 2
    OR char_length(trim(p_workspace_name)) > 200 THEN
    RAISE EXCEPTION 'invalid_workspace_name';
  END IF;

  IF p_plan IS NULL OR p_plan NOT IN ('starter', 'growth', 'agency') THEN
    RAISE EXCEPTION 'invalid_plan';
  END IF;

  SELECT lower(trim(auth_user.email))
  INTO v_auth_email
  FROM auth.users AS auth_user
  WHERE auth_user.id = p_auth_user_id
    AND auth_user.email_confirmed_at IS NOT NULL;

  IF v_auth_email IS NULL THEN
    RAISE EXCEPTION 'verified_auth_user_required';
  END IF;

  IF v_auth_email <> lower(trim(p_verified_email)) THEN
    RAISE EXCEPTION 'authenticated_email_mismatch';
  END IF;

  -- Serialize by verified identity, not user-controlled business name. This
  -- covers retries from multiple browser tabs and concurrent server requests.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('replova_account_onboarding:' || v_auth_email, 0)
  );

  -- Stable auth ownership wins. This keeps an existing account reachable even
  -- if its compatibility owner_email is changed later through a controlled flow.
  SELECT account.id, account.auth_user_id
  INTO v_account_id, v_account_auth_user_id
  FROM accounts AS account
  WHERE account.auth_user_id = p_auth_user_id
  FOR UPDATE;

  IF v_account_id IS NULL THEN
    -- Compatibility fallback is allowed only for an unambiguous one-to-one
    -- identity. Migration 027 deliberately leaves duplicate normalized-email
    -- records unlinked; onboarding must not let the first person to retry claim
    -- one of those accounts later.
    SELECT count(*)
    INTO v_matching_auth_count
    FROM auth.users AS auth_user
    WHERE lower(trim(auth_user.email)) = v_auth_email;

    SELECT count(*)
    INTO v_matching_account_count
    FROM accounts AS account
    WHERE lower(trim(account.owner_email)) = v_auth_email;

    IF v_matching_account_count > 1 THEN
      RAISE EXCEPTION 'account_email_identity_ambiguous';
    END IF;

    IF v_matching_account_count = 1 THEN
      SELECT account.id, account.auth_user_id
      INTO v_account_id, v_account_auth_user_id
      FROM accounts AS account
      WHERE lower(trim(account.owner_email)) = v_auth_email
      FOR UPDATE;
    END IF;

    IF v_account_id IS NOT NULL
      AND v_account_auth_user_id IS NOT NULL
      AND v_account_auth_user_id <> p_auth_user_id THEN
      RAISE EXCEPTION 'account_owned_by_another_auth_user';
    END IF;

    IF v_matching_auth_count <> 1 THEN
      RAISE EXCEPTION 'auth_email_identity_ambiguous';
    END IF;

    IF v_account_id IS NOT NULL AND v_account_auth_user_id IS NULL THEN
      UPDATE accounts
      SET auth_user_id = p_auth_user_id
      WHERE id = v_account_id
        AND auth_user_id IS NULL;
    END IF;
  END IF;

  IF v_account_id IS NULL THEN
    BEGIN
      INSERT INTO accounts (owner_email, auth_user_id, plan)
      VALUES (v_auth_email, p_auth_user_id, p_plan)
      RETURNING id INTO v_account_id;
      v_account_created := true;
    EXCEPTION WHEN unique_violation THEN
      -- A non-Phase-6B server path may have inserted between validation and the
      -- advisory lock. Re-run the one-to-one checks; never claim blindly.
      SELECT account.id, account.auth_user_id
      INTO v_account_id, v_account_auth_user_id
      FROM accounts AS account
      WHERE account.auth_user_id = p_auth_user_id
      FOR UPDATE;

      IF v_account_id IS NULL THEN
        SELECT count(*)
        INTO v_matching_auth_count
        FROM auth.users AS auth_user
        WHERE lower(trim(auth_user.email)) = v_auth_email;

        SELECT count(*)
        INTO v_matching_account_count
        FROM accounts AS account
        WHERE lower(trim(account.owner_email)) = v_auth_email;

        IF v_matching_auth_count <> 1 OR v_matching_account_count <> 1 THEN
          RAISE EXCEPTION 'account_identity_conflict';
        END IF;

        SELECT account.id, account.auth_user_id
        INTO v_account_id, v_account_auth_user_id
        FROM accounts AS account
        WHERE lower(trim(account.owner_email)) = v_auth_email
        FOR UPDATE;
      END IF;

      IF v_account_auth_user_id IS NOT NULL
        AND v_account_auth_user_id <> p_auth_user_id THEN
        RAISE EXCEPTION 'account_owned_by_another_auth_user';
      END IF;

      IF v_account_auth_user_id IS NULL THEN
        UPDATE accounts
        SET auth_user_id = p_auth_user_id
        WHERE id = v_account_id
          AND auth_user_id IS NULL;
      END IF;
    END;
  END IF;

  -- Existing workspaces always win. This preserves backfilled customers and
  -- makes a replay return the same workspace without renaming it.
  SELECT workspace.id
  INTO v_workspace_id
  FROM business_workspaces AS workspace
  WHERE workspace.account_id = v_account_id
  ORDER BY workspace.created_at, workspace.id
  LIMIT 1
  FOR UPDATE;

  IF v_workspace_id IS NULL THEN
    INSERT INTO business_workspaces (
      account_id,
      name,
      provisioning_source
    ) VALUES (
      v_account_id,
      trim(p_workspace_name),
      'system'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_workspace_id;

    IF v_workspace_id IS NULL THEN
      SELECT workspace.id
      INTO v_workspace_id
      FROM business_workspaces AS workspace
      WHERE workspace.account_id = v_account_id
      ORDER BY workspace.created_at, workspace.id
      LIMIT 1
      FOR UPDATE;
    ELSE
      v_workspace_created := true;
    END IF;
  END IF;

  RETURN QUERY SELECT
    v_account_id,
    v_workspace_id,
    v_account_created,
    v_workspace_created;
END;
$$;

COMMENT ON FUNCTION provision_replova_account_workspace(uuid, text, text, text) IS
  'Atomically creates or links one verified account and its initial workspace. Creates no location or provider record.';

REVOKE ALL ON FUNCTION provision_replova_account_workspace(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION provision_replova_account_workspace(uuid, text, text, text) TO service_role;

-- Deliberately absent: any call to provision_replova_account_workspace(...).
