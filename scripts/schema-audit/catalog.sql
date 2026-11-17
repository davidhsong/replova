-- Replova schema audit catalog snapshot.
--
-- Safety contract: this is one SELECT statement over PostgreSQL/Supabase
-- catalogs. It does not read rows from application tables and cannot mutate
-- database objects, migration history, configuration, or customer data.
WITH
catalog_tables AS (
  SELECT
    namespace.nspname AS schema_name,
    relation.relname AS table_name,
    relation.relrowsecurity AS rls_enabled,
    relation.relforcerowsecurity AS rls_forced
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relkind IN ('r', 'p')
),
catalog_columns AS (
  SELECT
    namespace.nspname AS schema_name,
    relation.relname AS table_name,
    attribute.attname AS column_name,
    attribute.attnum AS ordinal_position,
    pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) AS data_type,
    NOT attribute.attnotnull AS is_nullable,
    pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid) AS column_default
  FROM pg_catalog.pg_attribute AS attribute
  JOIN pg_catalog.pg_class AS relation ON relation.oid = attribute.attrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  LEFT JOIN pg_catalog.pg_attrdef AS default_value
    ON default_value.adrelid = attribute.attrelid
   AND default_value.adnum = attribute.attnum
  WHERE namespace.nspname = 'public'
    AND relation.relkind IN ('r', 'p')
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped
),
catalog_constraints AS (
  SELECT
    namespace.nspname AS schema_name,
    relation.relname AS table_name,
    constraint_row.conname AS constraint_name,
    constraint_row.contype AS constraint_type,
    pg_catalog.pg_get_constraintdef(constraint_row.oid, true) AS definition,
    constraint_row.condeferrable AS is_deferrable,
    constraint_row.condeferred AS is_initially_deferred,
    constraint_row.convalidated AS is_validated
  FROM pg_catalog.pg_constraint AS constraint_row
  JOIN pg_catalog.pg_class AS relation ON relation.oid = constraint_row.conrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
),
catalog_indexes AS (
  SELECT
    table_namespace.nspname AS schema_name,
    table_relation.relname AS table_name,
    index_relation.relname AS index_name,
    index_row.indisunique AS is_unique,
    index_row.indisprimary AS is_primary,
    index_row.indisvalid AS is_valid,
    pg_catalog.pg_get_indexdef(index_row.indexrelid) AS definition
  FROM pg_catalog.pg_index AS index_row
  JOIN pg_catalog.pg_class AS table_relation ON table_relation.oid = index_row.indrelid
  JOIN pg_catalog.pg_namespace AS table_namespace ON table_namespace.oid = table_relation.relnamespace
  JOIN pg_catalog.pg_class AS index_relation ON index_relation.oid = index_row.indexrelid
  WHERE table_namespace.nspname = 'public'
),
catalog_policies AS (
  SELECT
    schemaname AS schema_name,
    tablename AS table_name,
    policyname AS policy_name,
    permissive,
    roles,
    cmd AS command,
    qual AS using_expression,
    with_check AS check_expression
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public'
),
catalog_schema_grants AS (
  SELECT
    namespace.nspname AS schema_name,
    COALESCE(grantee.rolname, 'PUBLIC') AS grantee,
    privilege.privilege_type,
    privilege.is_grantable
  FROM pg_catalog.pg_namespace AS namespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(namespace.nspacl, pg_catalog.acldefault('n', namespace.nspowner))
  ) AS privilege
  LEFT JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = privilege.grantee
  WHERE namespace.nspname = 'public'
),
catalog_table_grants AS (
  SELECT
    namespace.nspname AS schema_name,
    relation.relname AS table_name,
    COALESCE(grantee.rolname, 'PUBLIC') AS grantee,
    privilege.privilege_type,
    privilege.is_grantable
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(relation.relacl, pg_catalog.acldefault('r', relation.relowner))
  ) AS privilege
  LEFT JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = privilege.grantee
  WHERE namespace.nspname = 'public'
    AND relation.relkind IN ('r', 'p')
),
catalog_sequence_grants AS (
  SELECT
    namespace.nspname AS schema_name,
    relation.relname AS sequence_name,
    COALESCE(grantee.rolname, 'PUBLIC') AS grantee,
    privilege.privilege_type,
    privilege.is_grantable
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(relation.relacl, pg_catalog.acldefault('S', relation.relowner))
  ) AS privilege
  LEFT JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = privilege.grantee
  WHERE namespace.nspname = 'public'
    AND relation.relkind = 'S'
),
catalog_functions AS (
  SELECT
    namespace.nspname AS schema_name,
    procedure.proname AS function_name,
    pg_catalog.pg_get_function_identity_arguments(procedure.oid) AS identity_arguments,
    pg_catalog.pg_get_function_result(procedure.oid) AS result_type,
    language.lanname AS language_name,
    procedure.prosecdef AS security_definer,
    procedure.provolatile AS volatility,
    procedure.proparallel AS parallel_safety,
    COALESCE(procedure.proconfig, ARRAY[]::text[]) AS configuration,
    pg_catalog.md5(procedure.prosrc) AS source_hash,
    pg_catalog.md5(pg_catalog.pg_get_functiondef(procedure.oid)) AS definition_hash
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  JOIN pg_catalog.pg_language AS language ON language.oid = procedure.prolang
  WHERE namespace.nspname = 'public'
    AND procedure.prokind IN ('f', 'p')
),
catalog_function_grants AS (
  SELECT
    namespace.nspname AS schema_name,
    procedure.proname AS function_name,
    pg_catalog.pg_get_function_identity_arguments(procedure.oid) AS identity_arguments,
    COALESCE(grantee.rolname, 'PUBLIC') AS grantee,
    privilege.privilege_type,
    privilege.is_grantable
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
  ) AS privilege
  LEFT JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = privilege.grantee
  WHERE namespace.nspname = 'public'
    AND procedure.prokind IN ('f', 'p')
),
catalog_triggers AS (
  SELECT
    namespace.nspname AS schema_name,
    relation.relname AS table_name,
    trigger_row.tgname AS trigger_name,
    trigger_row.tgenabled AS enabled_state,
    pg_catalog.pg_get_triggerdef(trigger_row.oid, true) AS definition
  FROM pg_catalog.pg_trigger AS trigger_row
  JOIN pg_catalog.pg_class AS relation ON relation.oid = trigger_row.tgrelid
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND NOT trigger_row.tgisinternal
),
catalog_migrations AS (
  SELECT version::text AS version, name::text AS name
  FROM supabase_migrations.schema_migrations
)
SELECT pg_catalog.jsonb_build_object(
  'format_version', 1,
  'captured_at', pg_catalog.clock_timestamp(),
  'server_version_num', pg_catalog.current_setting('server_version_num'),
  'tables', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.schema_name, item.table_name)
    FROM catalog_tables AS item
  ), '[]'::jsonb),
  'columns', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.schema_name, item.table_name, item.ordinal_position)
    FROM catalog_columns AS item
  ), '[]'::jsonb),
  'constraints', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.schema_name, item.table_name, item.constraint_name)
    FROM catalog_constraints AS item
  ), '[]'::jsonb),
  'indexes', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.schema_name, item.table_name, item.index_name)
    FROM catalog_indexes AS item
  ), '[]'::jsonb),
  'policies', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.schema_name, item.table_name, item.policy_name)
    FROM catalog_policies AS item
  ), '[]'::jsonb),
  'schema_grants', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.schema_name, item.grantee, item.privilege_type)
    FROM catalog_schema_grants AS item
  ), '[]'::jsonb),
  'table_grants', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.schema_name, item.table_name, item.grantee, item.privilege_type)
    FROM catalog_table_grants AS item
  ), '[]'::jsonb),
  'sequence_grants', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.schema_name, item.sequence_name, item.grantee, item.privilege_type)
    FROM catalog_sequence_grants AS item
  ), '[]'::jsonb),
  'functions', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.schema_name, item.function_name, item.identity_arguments)
    FROM catalog_functions AS item
  ), '[]'::jsonb),
  'function_grants', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.schema_name, item.function_name, item.identity_arguments, item.grantee, item.privilege_type)
    FROM catalog_function_grants AS item
  ), '[]'::jsonb),
  'triggers', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.schema_name, item.table_name, item.trigger_name)
    FROM catalog_triggers AS item
  ), '[]'::jsonb),
  'migrations', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.version)
    FROM catalog_migrations AS item
  ), '[]'::jsonb)
) AS schema_audit;
