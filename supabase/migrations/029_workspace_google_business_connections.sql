-- Phase 6C1: workspace-scoped Google Business Profile OAuth and location links.
--
-- Apply manually after migrations 027 and 028. This migration is independent
-- of the parked migration 026. Schema application is inert: it does not copy,
-- decrypt, clear, or otherwise modify legacy restaurant credentials, locations,
-- reviews, subscriptions, or workspace records.

CREATE TABLE IF NOT EXISTS google_business_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE
    REFERENCES business_workspaces(id) ON DELETE CASCADE,
  connected_by_auth_user_id uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,
  google_subject text,
  google_email text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at bigint,
  granted_scopes text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'active',
  last_error_code text,
  last_error_at timestamptz,
  connected_at timestamptz NOT NULL DEFAULT now(),
  refreshed_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_business_connections_id_workspace_key
    UNIQUE (id, workspace_id),
  CONSTRAINT google_business_connections_status_check
    CHECK (status IN ('active', 'reauthorization_required', 'disconnected', 'error')),
  CONSTRAINT google_business_connections_token_state_check
    CHECK (
      status <> 'active'
      OR (
        access_token_encrypted IS NOT NULL
        AND refresh_token_encrypted IS NOT NULL
        AND token_expires_at IS NOT NULL
      )
    )
);

COMMENT ON TABLE google_business_connections IS
  'One encrypted Google Business OAuth connection per Replova workspace. Tokens are application-encrypted before storage.';

-- A Google location ID is stable across the account-specific resource parents
-- through which an authorized user may access the same business. Keep one
-- canonical identity on the internal location while preserving every valid
-- account/location association below for Reviews API v4 calls.
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS google_business_location_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurants_google_business_location_id_check'
      AND conrelid = 'restaurants'::regclass
  ) THEN
    ALTER TABLE restaurants
      ADD CONSTRAINT restaurants_google_business_location_id_check
      CHECK (
        google_business_location_id IS NULL
        OR google_business_location_id ~ '^[A-Za-z0-9_-]{1,128}$'
      );
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS restaurants_workspace_google_location_id_unique
  ON restaurants(workspace_id, google_business_location_id)
  WHERE workspace_id IS NOT NULL AND google_business_location_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS google_business_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL
    REFERENCES business_workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL
    REFERENCES google_business_connections(id) ON DELETE RESTRICT,
  restaurant_id uuid
    REFERENCES restaurants(id) ON DELETE SET NULL,
  account_resource_name text NOT NULL,
  account_id text NOT NULL,
  location_resource_name text NOT NULL,
  location_id text NOT NULL,
  review_parent_resource_name text NOT NULL,
  title text NOT NULL,
  place_id text,
  selected_by_auth_user_id uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,
  selected_at timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  disconnected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_business_locations_workspace_resource_key
    UNIQUE (workspace_id, review_parent_resource_name),
  CONSTRAINT google_business_locations_connection_workspace_fkey
    FOREIGN KEY (connection_id, workspace_id)
    REFERENCES google_business_connections(id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT google_business_locations_account_resource_check
    CHECK (account_resource_name = 'accounts/' || account_id),
  CONSTRAINT google_business_locations_location_resource_check
    CHECK (location_resource_name = 'locations/' || location_id),
  CONSTRAINT google_business_locations_review_parent_check
    CHECK (review_parent_resource_name = account_resource_name || '/' || location_resource_name),
  CONSTRAINT google_business_locations_title_length_check
    CHECK (char_length(trim(title)) BETWEEN 1 AND 200)
);

COMMENT ON TABLE google_business_locations IS
  'Authorized account-specific resource associations for canonical internal business locations.';

COMMENT ON COLUMN google_business_locations.review_parent_resource_name IS
  'Full accounts/{accountId}/locations/{locationId} parent required by the Google My Business Reviews API v4.';

CREATE INDEX IF NOT EXISTS google_business_locations_connection_idx
  ON google_business_locations(connection_id, is_active, selected_at);

CREATE INDEX IF NOT EXISTS google_business_locations_restaurant_idx
  ON google_business_locations(restaurant_id)
  WHERE restaurant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS google_business_locations_canonical_identity_idx
  ON google_business_locations(workspace_id, location_id, is_active, last_verified_at);

CREATE TABLE IF NOT EXISTS google_business_oauth_states (
  state_hash text PRIMARY KEY,
  workspace_id uuid NOT NULL
    REFERENCES business_workspaces(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_business_oauth_states_hash_check
    CHECK (state_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT google_business_oauth_states_expiry_check
    CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS google_business_oauth_states_expiry_idx
  ON google_business_oauth_states(expires_at)
  WHERE consumed_at IS NULL;

DROP TRIGGER IF EXISTS google_business_connections_updated_at ON google_business_connections;
CREATE TRIGGER google_business_connections_updated_at
BEFORE UPDATE ON google_business_connections
FOR EACH ROW EXECUTE FUNCTION set_replova_workspace_updated_at();

DROP TRIGGER IF EXISTS google_business_locations_updated_at ON google_business_locations;
CREATE TRIGGER google_business_locations_updated_at
BEFORE UPDATE ON google_business_locations
FOR EACH ROW EXECUTE FUNCTION set_replova_workspace_updated_at();

ALTER TABLE google_business_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_business_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_business_oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "google business connection owner select" ON google_business_connections;
CREATE POLICY "google business connection owner select"
ON google_business_connections FOR SELECT TO authenticated
USING (current_user_owns_replova_workspace(workspace_id));

DROP POLICY IF EXISTS "google business location owner select" ON google_business_locations;
CREATE POLICY "google business location owner select"
ON google_business_locations FOR SELECT TO authenticated
USING (current_user_owns_replova_workspace(workspace_id));

-- Encrypted credentials and OAuth state remain server-only. Selected location
-- metadata may be read by its owner, but every mutation remains server-only.
REVOKE ALL ON TABLE google_business_connections FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE google_business_locations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE google_business_oauth_states FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE google_business_locations TO authenticated;
GRANT ALL ON TABLE google_business_connections TO service_role;
GRANT ALL ON TABLE google_business_locations TO service_role;
GRANT ALL ON TABLE google_business_oauth_states TO service_role;

CREATE OR REPLACE FUNCTION consume_google_business_oauth_state(
  p_state_hash text,
  p_auth_user_id uuid
)
RETURNS TABLE (workspace_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  IF p_state_hash IS NULL OR p_state_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_oauth_state_hash';
  END IF;

  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'authenticated_user_required';
  END IF;

  UPDATE google_business_oauth_states AS oauth_state
  SET consumed_at = now()
  WHERE oauth_state.state_hash = p_state_hash
    AND oauth_state.auth_user_id = p_auth_user_id
    AND oauth_state.consumed_at IS NULL
    AND oauth_state.expires_at > now()
  RETURNING oauth_state.workspace_id INTO v_workspace_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'oauth_state_invalid_expired_or_replayed';
  END IF;

  RETURN QUERY SELECT v_workspace_id;
END;
$$;

COMMENT ON FUNCTION consume_google_business_oauth_state(text, uuid) IS
  'Atomically consumes one workspace- and Auth-bound Google OAuth state. Replays and expired states fail closed.';

CREATE OR REPLACE FUNCTION link_google_business_locations(
  p_workspace_id uuid,
  p_auth_user_id uuid,
  p_connection_id uuid,
  p_google_subject text,
  p_locations jsonb,
  p_new_locations_active boolean DEFAULT false
)
RETURNS TABLE (
  location_link_id uuid,
  linked_restaurant_id uuid,
  linked_review_resource_name text,
  restaurant_created boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_account_id uuid;
  v_owner_email text;
  v_plan text;
  v_connection_id uuid;
  v_location_limit integer;
  v_restaurant_count integer;
  v_item jsonb;
  v_account_resource text;
  v_account_google_id text;
  v_location_resource text;
  v_location_google_id text;
  v_review_parent text;
  v_title text;
  v_place_id text;
  v_restaurant_id uuid;
  v_link_id uuid;
  v_restaurant_created boolean;
  v_conflicting_location_id text;
  v_legacy_match_count integer;
BEGIN
  IF p_workspace_id IS NULL OR p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'workspace_and_authenticated_user_required';
  END IF;

  IF p_locations IS NULL
    OR jsonb_typeof(p_locations) <> 'array'
    OR jsonb_array_length(p_locations) < 1
    OR jsonb_array_length(p_locations) > 15 THEN
    RAISE EXCEPTION 'invalid_google_location_selection';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_locations) AS item(value)
    GROUP BY nullif(trim(item.value->>'reviewResourceName'), '')
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate_google_location_resource';
  END IF;

  SELECT account.id, account.owner_email, account.plan
  INTO v_account_id, v_owner_email, v_plan
  FROM business_workspaces AS workspace
  JOIN accounts AS account ON account.id = workspace.account_id
  WHERE workspace.id = p_workspace_id
    AND workspace.status = 'active'
    AND account.auth_user_id = p_auth_user_id
  FOR UPDATE OF account, workspace;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'workspace_not_owned';
  END IF;

  SELECT connection.id
  INTO v_connection_id
  FROM google_business_connections AS connection
  WHERE connection.workspace_id = p_workspace_id
    AND connection.status = 'active'
    AND connection.id = p_connection_id
    AND connection.google_subject = nullif(trim(p_google_subject), '')
    AND connection.access_token_encrypted IS NOT NULL
    AND connection.refresh_token_encrypted IS NOT NULL
  FOR UPDATE;

  IF v_connection_id IS NULL THEN
    RAISE EXCEPTION 'google_business_connection_required';
  END IF;

  v_location_limit := CASE v_plan
    WHEN 'starter' THEN 1
    WHEN 'growth' THEN 5
    WHEN 'agency' THEN 15
    ELSE 0
  END;

  SELECT count(*)::integer
  INTO v_restaurant_count
  FROM restaurants AS restaurant
  WHERE restaurant.workspace_id = p_workspace_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_locations)
  LOOP
    v_account_resource := nullif(trim(v_item->>'accountResourceName'), '');
    v_account_google_id := nullif(trim(v_item->>'accountId'), '');
    v_location_resource := nullif(trim(v_item->>'locationResourceName'), '');
    v_location_google_id := nullif(trim(v_item->>'locationId'), '');
    v_review_parent := nullif(trim(v_item->>'reviewResourceName'), '');
    v_title := left(nullif(trim(v_item->>'title'), ''), 200);
    v_place_id := nullif(trim(v_item->>'placeId'), '');
    v_restaurant_id := NULL;
    v_link_id := NULL;
    v_restaurant_created := false;
    v_conflicting_location_id := NULL;
    v_legacy_match_count := 0;

    IF v_account_google_id IS NULL
      OR v_account_google_id !~ '^[A-Za-z0-9_-]{1,128}$'
      OR v_location_google_id IS NULL
      OR v_location_google_id !~ '^[A-Za-z0-9_-]{1,128}$'
      OR v_account_resource <> 'accounts/' || v_account_google_id
      OR v_location_resource <> 'locations/' || v_location_google_id
      OR v_review_parent <> v_account_resource || '/' || v_location_resource
      OR v_title IS NULL
      OR (v_place_id IS NOT NULL AND char_length(v_place_id) > 300) THEN
      RAISE EXCEPTION 'invalid_google_location_resource';
    END IF;

    SELECT link.id, link.restaurant_id
    INTO v_link_id, v_restaurant_id
    FROM google_business_locations AS link
    WHERE link.workspace_id = p_workspace_id
      AND link.review_parent_resource_name = v_review_parent
    FOR UPDATE;

    IF v_restaurant_id IS NULL THEN
      SELECT link.restaurant_id
      INTO v_restaurant_id
      FROM google_business_locations AS link
      WHERE link.workspace_id = p_workspace_id
        AND link.location_id = v_location_google_id
        AND link.restaurant_id IS NOT NULL
      ORDER BY link.is_active DESC, link.last_verified_at DESC, link.id
      LIMIT 1
      FOR UPDATE;
    END IF;

    IF v_restaurant_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM restaurants AS linked_restaurant
      WHERE linked_restaurant.id = v_restaurant_id
        AND linked_restaurant.workspace_id = p_workspace_id
    ) THEN
      v_restaurant_id := NULL;
    END IF;

    IF v_restaurant_id IS NULL THEN
      SELECT count(*)::integer
      INTO v_legacy_match_count
      FROM restaurants AS restaurant
      WHERE restaurant.workspace_id = p_workspace_id
        AND (
          restaurant.google_business_location_id = v_location_google_id
          OR restaurant.google_location_name IN (v_review_parent, v_location_resource)
          OR (
            restaurant.google_location_name ~ '^accounts/[A-Za-z0-9_-]{1,128}/locations/[A-Za-z0-9_-]{1,128}$'
            AND split_part(restaurant.google_location_name, '/', 4) = v_location_google_id
          )
          OR (v_place_id IS NOT NULL AND restaurant.place_id = v_place_id)
        );

      IF v_legacy_match_count > 1 THEN
        RAISE EXCEPTION 'ambiguous_legacy_google_location';
      END IF;

      SELECT restaurant.id
      INTO v_restaurant_id
      FROM restaurants AS restaurant
      WHERE restaurant.workspace_id = p_workspace_id
        AND (
          restaurant.google_business_location_id = v_location_google_id
          OR restaurant.google_location_name IN (v_review_parent, v_location_resource)
          OR (
            restaurant.google_location_name ~ '^accounts/[A-Za-z0-9_-]{1,128}/locations/[A-Za-z0-9_-]{1,128}$'
            AND split_part(restaurant.google_location_name, '/', 4) = v_location_google_id
          )
          OR (v_place_id IS NOT NULL AND restaurant.place_id = v_place_id)
        )
      ORDER BY
        (restaurant.google_business_location_id = v_location_google_id) DESC,
        (restaurant.google_location_name = v_review_parent) DESC,
        (restaurant.google_location_name = v_location_resource) DESC,
        restaurant.created_at,
        restaurant.id
      LIMIT 1
      FOR UPDATE;
    END IF;

    IF v_restaurant_id IS NOT NULL
      AND v_place_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM restaurants AS identity_restaurant
        WHERE identity_restaurant.id = v_restaurant_id
          AND identity_restaurant.place_id IS NOT NULL
          AND identity_restaurant.place_id <> v_place_id
      ) THEN
      RAISE EXCEPTION 'google_location_identity_conflict';
    END IF;

    IF v_place_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM restaurants AS claimed_restaurant
      WHERE claimed_restaurant.place_id = v_place_id
        AND (v_restaurant_id IS NULL OR claimed_restaurant.id <> v_restaurant_id)
    ) THEN
      RAISE EXCEPTION 'google_location_already_linked';
    END IF;

    IF v_restaurant_id IS NULL THEN
      IF v_restaurant_count >= v_location_limit THEN
        RAISE EXCEPTION 'subscription_location_limit_exceeded';
      END IF;

      INSERT INTO restaurants (
        workspace_id,
        name,
        place_id,
        owner_email,
        active,
        google_location_name,
        google_business_location_id
      ) VALUES (
        p_workspace_id,
        v_title,
        v_place_id,
        v_owner_email,
        coalesce(p_new_locations_active, false),
        v_review_parent,
        v_location_google_id
      )
      RETURNING id INTO v_restaurant_id;

      INSERT INTO restaurant_settings (restaurant_id)
      VALUES (v_restaurant_id)
      ON CONFLICT (restaurant_id) DO NOTHING;

      v_restaurant_count := v_restaurant_count + 1;
      v_restaurant_created := true;
    ELSE
      SELECT restaurant.google_business_location_id
      INTO v_conflicting_location_id
      FROM restaurants AS restaurant
      WHERE restaurant.id = v_restaurant_id
        AND restaurant.google_business_location_id IS NOT NULL
        AND restaurant.google_business_location_id <> v_location_google_id;

      IF v_conflicting_location_id IS NOT NULL THEN
        RAISE EXCEPTION 'restaurant_google_location_conflict';
      END IF;

      UPDATE restaurants AS restaurant
      SET google_location_name = CASE
            WHEN restaurant.google_location_name IS NULL
              OR restaurant.google_location_name = v_location_resource
            THEN v_review_parent
            ELSE restaurant.google_location_name
          END,
          google_business_location_id = v_location_google_id,
          place_id = coalesce(restaurant.place_id, v_place_id)
      WHERE restaurant.id = v_restaurant_id;
    END IF;

    INSERT INTO google_business_locations AS link (
      workspace_id,
      connection_id,
      restaurant_id,
      account_resource_name,
      account_id,
      location_resource_name,
      location_id,
      review_parent_resource_name,
      title,
      place_id,
      selected_by_auth_user_id,
      selected_at,
      last_verified_at,
      is_active,
      disconnected_at
    ) VALUES (
      p_workspace_id,
      v_connection_id,
      v_restaurant_id,
      v_account_resource,
      v_account_google_id,
      v_location_resource,
      v_location_google_id,
      v_review_parent,
      v_title,
      v_place_id,
      p_auth_user_id,
      now(),
      now(),
      true,
      NULL
    )
    ON CONFLICT ON CONSTRAINT google_business_locations_workspace_resource_key
    DO UPDATE SET
      connection_id = EXCLUDED.connection_id,
      restaurant_id = EXCLUDED.restaurant_id,
      account_resource_name = EXCLUDED.account_resource_name,
      account_id = EXCLUDED.account_id,
      location_resource_name = EXCLUDED.location_resource_name,
      location_id = EXCLUDED.location_id,
      title = EXCLUDED.title,
      place_id = EXCLUDED.place_id,
      selected_by_auth_user_id = EXCLUDED.selected_by_auth_user_id,
      selected_at = now(),
      last_verified_at = now(),
      is_active = true,
      disconnected_at = NULL
    RETURNING link.id INTO v_link_id;

    location_link_id := v_link_id;
    linked_restaurant_id := v_restaurant_id;
    linked_review_resource_name := v_review_parent;
    restaurant_created := v_restaurant_created;
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION link_google_business_locations(uuid, uuid, uuid, text, jsonb, boolean) IS
  'Atomically verifies workspace ownership, enforces plan location limits, and links live-authorized Google resources without duplicating restaurants.';

CREATE OR REPLACE FUNCTION disconnect_google_business_workspace(
  p_workspace_id uuid,
  p_auth_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM business_workspaces AS workspace
    JOIN accounts AS account ON account.id = workspace.account_id
    WHERE workspace.id = p_workspace_id
      AND workspace.status = 'active'
      AND account.auth_user_id = p_auth_user_id
  ) THEN
    RAISE EXCEPTION 'workspace_not_owned';
  END IF;

  UPDATE google_business_connections AS connection
  SET access_token_encrypted = NULL,
      refresh_token_encrypted = NULL,
      token_expires_at = NULL,
      status = 'disconnected',
      disconnected_at = now(),
      last_error_code = NULL,
      last_error_at = NULL
  WHERE connection.workspace_id = p_workspace_id;

  UPDATE google_business_locations AS location_link
  SET is_active = false,
      disconnected_at = now()
  WHERE location_link.workspace_id = p_workspace_id;

  -- Clear only credentials. Durable locations, Google resource identifiers,
  -- reviews, analytics, subscriptions, and workspace records are preserved.
  UPDATE restaurants AS restaurant
  SET google_access_token = NULL,
      google_refresh_token = NULL,
      google_token_expires_at = NULL
  WHERE restaurant.workspace_id = p_workspace_id;
END;
$$;

COMMENT ON FUNCTION disconnect_google_business_workspace(uuid, uuid) IS
  'Atomically removes workspace Google credentials and deactivates links without deleting durable business or review data.';

REVOKE ALL ON FUNCTION consume_google_business_oauth_state(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION link_google_business_locations(uuid, uuid, uuid, text, jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION disconnect_google_business_workspace(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION consume_google_business_oauth_state(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION link_google_business_locations(uuid, uuid, uuid, text, jsonb, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION disconnect_google_business_workspace(uuid, uuid) TO service_role;

-- Deliberately absent: credential backfill, location backfill, and any calls to
-- the state-consumption or location-linking functions.
