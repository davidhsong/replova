# Read-only schema audit

This tool compares migrations 017–031 (with the intentionally absent 026)
against a sanitized PostgreSQL catalog snapshot. It never connects to Supabase.

1. Run `npm run schema:audit:check` to validate the catalog query and materialize
   the repository migrations in an isolated in-memory PGlite database.
2. In the intended Supabase project's SQL editor, inspect and run
   `scripts/schema-audit/catalog.sql`. It is one catalog-only `WITH ... SELECT`
   statement. Export the one-row result as JSON or CSV.
3. Run:

   `npm run schema:audit -- --snapshot <export> --output <new-report.json>`

The output path must not already exist. This avoids silently overwriting an
earlier audit. The report contains schema metadata and hashes, never table rows,
OAuth credentials, access tokens, function source, or secrets.

The comparison covers tables, columns, data types, defaults, keys and other
constraints, indexes, RLS, policies, effective grants for `PUBLIC`, `anon`,
`authenticated`, and `service_role`, functions, function authorization and
search-path configuration, triggers, and the Supabase migration ledger.
It also reports `SECURITY DEFINER` functions that are executable by `PUBLIC`,
`anon`, or `authenticated`, and functions whose configured search path does not
start with `pg_catalog`. These authorization findings are reported even when the
live catalog exactly matches the repository SQL.

Known limitations are included in every generated report. In particular,
Supabase-managed `auth`/`storage` internals, object comments and owners, default
privileges, event triggers, and column-level grants are not compared. Catalog
rendering differences between PostgreSQL versions are reported for review and
are never assumed to match.
