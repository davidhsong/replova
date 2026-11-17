import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'

export const targetMigrationVersions = [
  '017', '018', '019', '020', '021', '022', '023', '024',
  '025', '027', '028', '029', '030', '031', '032',
] as const

export const intentionallyExcludedVersions = ['026'] as const

const catalogSections = [
  'tables',
  'columns',
  'constraints',
  'indexes',
  'policies',
  'schema_grants',
  'table_grants',
  'sequence_grants',
  'functions',
  'function_grants',
  'triggers',
  'migrations',
] as const

type CatalogSection = (typeof catalogSections)[number]
type CatalogRow = Record<string, unknown>

export interface SchemaSnapshot {
  format_version: number
  captured_at?: string
  server_version_num?: string
  tables: CatalogRow[]
  columns: CatalogRow[]
  constraints: CatalogRow[]
  indexes: CatalogRow[]
  policies: CatalogRow[]
  schema_grants: CatalogRow[]
  table_grants: CatalogRow[]
  sequence_grants: CatalogRow[]
  functions: CatalogRow[]
  function_grants: CatalogRow[]
  triggers: CatalogRow[]
  migrations: CatalogRow[]
}

interface MigrationFile {
  version: string
  name: string
  absolutePath: string
}

interface MigrationStep {
  version: string
  name: string
  changedKeys: string[]
}

export interface ExpectedSchemaModel {
  baseline: SchemaSnapshot
  expected: SchemaSnapshot
  steps: MigrationStep[]
  repositoryMigrations: Array<{ version: string; name: string }>
}

export interface SchemaDifference {
  section: CatalogSection
  key: string
  migration: string | null
  kind: 'missing' | 'unexpected' | 'conflicting'
  differing_fields?: string[]
  expected_fingerprint?: string
  actual_fingerprint?: string
}

export interface MigrationStatus {
  version: string
  name: string
  ledger_recorded: boolean
  structure_status:
    | 'applied_recorded'
    | 'applied_unrecorded'
    | 'pending'
    | 'recorded_but_missing'
    | 'partial_or_conflicting'
    | 'superseded'
  matching_objects: number
  missing_objects: number
  unexpected_objects: number
  conflicting_objects: number
}

export interface SchemaAuditReport {
  format_version: 1
  generated_at: string
  safety: {
    catalog_query_read_only: true
    application_rows_read: false
    expected_schema_target: 'in-memory-pglite-only'
    connected_database_mutated: false
  }
  summary: {
    matching_objects: number
    missing_objects: number
    unexpected_objects: number
    conflicting_objects: number
    applied_recorded_migrations: number
    applied_unrecorded_migrations: number
    pending_migrations: number
    recorded_but_missing_migrations: number
    partial_or_conflicting_migrations: number
  }
  migration_status: MigrationStatus[]
  excluded_migration_status: Array<{
    version: string
    repository_file_present: boolean
    ledger_recorded: boolean
    status: 'excluded' | 'excluded_but_recorded' | 'unexpected_repository_file'
  }>
  differences: SchemaDifference[]
  security_findings: Array<{
    severity: 'high' | 'warning'
    code:
      | 'security_definer_untrusted_execute'
      | 'security_definer_authenticated_execute'
      | 'security_definer_missing_search_path'
      | 'security_definer_mutable_search_path'
    function: string
    roles?: string[]
    configuration?: string[]
  }>
  limitations: string[]
}

const identityFields: Record<CatalogSection, string[]> = {
  tables: ['schema_name', 'table_name'],
  columns: ['schema_name', 'table_name', 'column_name'],
  constraints: ['schema_name', 'table_name', 'constraint_name'],
  indexes: ['schema_name', 'table_name', 'index_name'],
  policies: ['schema_name', 'table_name', 'policy_name'],
  schema_grants: ['schema_name', 'grantee', 'privilege_type'],
  table_grants: ['schema_name', 'table_name', 'grantee', 'privilege_type'],
  sequence_grants: ['schema_name', 'sequence_name', 'grantee', 'privilege_type'],
  functions: ['schema_name', 'function_name', 'identity_arguments'],
  function_grants: [
    'schema_name', 'function_name', 'identity_arguments', 'grantee', 'privilege_type',
  ],
  triggers: ['schema_name', 'table_name', 'trigger_name'],
  migrations: ['version'],
}

const tableSections = new Set<CatalogSection>([
  'tables', 'columns', 'constraints', 'indexes', 'policies', 'table_grants', 'triggers',
])

const functionSections = new Set<CatalogSection>(['functions', 'function_grants'])
const comparedGrantees = new Set(['PUBLIC', 'anon', 'authenticated', 'service_role'])

function stripSqlCommentsAndLiterals(sql: string): string {
  let output = ''
  let index = 0
  let state: 'normal' | 'single' | 'double' | 'line' | 'block' | 'dollar' = 'normal'
  let dollarTag = ''

  while (index < sql.length) {
    const current = sql[index]
    const next = sql[index + 1]

    if (state === 'line') {
      if (current === '\n') {
        state = 'normal'
        output += '\n'
      } else output += ' '
      index += 1
      continue
    }

    if (state === 'block') {
      if (current === '*' && next === '/') {
        output += '  '
        index += 2
        state = 'normal'
      } else {
        output += current === '\n' ? '\n' : ' '
        index += 1
      }
      continue
    }

    if (state === 'single') {
      if (current === "'" && next === "'") {
        output += '  '
        index += 2
      } else if (current === "'") {
        output += ' '
        index += 1
        state = 'normal'
      } else {
        output += current === '\n' ? '\n' : ' '
        index += 1
      }
      continue
    }

    if (state === 'double') {
      if (current === '"' && next === '"') {
        output += '  '
        index += 2
      } else if (current === '"') {
        output += ' '
        index += 1
        state = 'normal'
      } else {
        output += current === '\n' ? '\n' : ' '
        index += 1
      }
      continue
    }

    if (state === 'dollar') {
      if (sql.startsWith(dollarTag, index)) {
        output += ' '.repeat(dollarTag.length)
        index += dollarTag.length
        state = 'normal'
      } else {
        output += current === '\n' ? '\n' : ' '
        index += 1
      }
      continue
    }

    if (current === '-' && next === '-') {
      output += '  '
      index += 2
      state = 'line'
    } else if (current === '/' && next === '*') {
      output += '  '
      index += 2
      state = 'block'
    } else if (current === "'") {
      output += ' '
      index += 1
      state = 'single'
    } else if (current === '"') {
      output += ' '
      index += 1
      state = 'double'
    } else if (current === '$') {
      const tag = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)?.[0]
      if (tag) {
        dollarTag = tag
        output += ' '.repeat(tag.length)
        index += tag.length
        state = 'dollar'
      } else {
        output += current
        index += 1
      }
    } else {
      output += current
      index += 1
    }
  }

  return output
}

export function assertReadOnlyCatalogQuery(sql: string): void {
  const stripped = stripSqlCommentsAndLiterals(sql)
  const forbidden = stripped.match(
    /\b(?:insert|update|delete|merge|alter|create|drop|truncate|call|do|copy|grant|revoke|execute|vacuum|analyze|refresh|reindex|cluster|comment|security\s+label)\b/i,
  )
  if (forbidden) {
    throw new Error(`Catalog query is not read-only: found ${forbidden[0]}`)
  }

  const statements = stripped.split(';').map(statement => statement.trim()).filter(Boolean)
  if (statements.length !== 1 || !/^WITH\b/i.test(statements[0]) || !/\bSELECT\b/i.test(statements[0])) {
    throw new Error('Catalog query must be exactly one WITH ... SELECT statement')
  }
}

function normalizeString(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === 'string') return normalizeString(value)
  if (Array.isArray(value)) return value.map(normalizeValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalizeValue(item)]),
    )
  }
  return value
}

function comparisonRow(section: CatalogSection, row: CatalogRow): CatalogRow {
  const normalized = normalizeValue(row) as CatalogRow
  if (section === 'functions') {
    const stable = { ...normalized }
    delete stable.definition_hash
    delete stable.source_hash_crlf
    return stable
  }
  return normalized
}

function comparisonPair(
  section: CatalogSection,
  expected: CatalogRow,
  actual: CatalogRow,
): [CatalogRow, CatalogRow] {
  const left = comparisonRow(section, expected)
  const right = comparisonRow(section, actual)
  if (
    section === 'functions'
    && expected.source_hash_crlf
    && expected.source_hash_crlf === actual.source_hash
  ) left.source_hash = actual.source_hash
  return [left, right]
}

function fingerprint(section: CatalogSection, row: CatalogRow): string {
  return createHash('sha256')
    .update(JSON.stringify(comparisonRow(section, row)))
    .digest('hex')
    .slice(0, 16)
}

function rowKey(section: CatalogSection, row: CatalogRow): string {
  const values = identityFields[section].map(field => {
    const value = row[field]
    if (value === null || value === undefined) return ''
    return normalizeString(String(value))
  })
  return `${section}:${values.join(':')}`
}

function relevantRows(section: CatalogSection, rows: CatalogRow[]): CatalogRow[] {
  if (section === 'constraints') {
    // PostgreSQL 18/PGlite exposes NOT NULL rows in pg_constraint (contype=n),
    // while older Supabase PostgreSQL versions expose the same property only
    // through pg_attribute.attnotnull. Columns already compare nullability.
    return rows.filter(row => row.constraint_type !== 'n')
  }
  if (section !== 'table_grants' && section !== 'function_grants' && section !== 'schema_grants') {
    return rows
  }
  return rows.filter(row => comparedGrantees.has(String(row.grantee)))
}

function sectionMap(snapshot: SchemaSnapshot, section: CatalogSection): Map<string, CatalogRow> {
  return new Map(
    relevantRows(section, snapshot[section]).map(row => [rowKey(section, row), row]),
  )
}

function changedKeys(before: SchemaSnapshot, after: SchemaSnapshot): string[] {
  const changed: string[] = []
  for (const section of catalogSections) {
    if (section === 'migrations') continue
    const beforeMap = sectionMap(before, section)
    const afterMap = sectionMap(after, section)
    const keys = new Set([...beforeMap.keys(), ...afterMap.keys()])
    for (const key of keys) {
      const left = beforeMap.get(key)
      const right = afterMap.get(key)
      if (!left || !right || fingerprint(section, left) !== fingerprint(section, right)) changed.push(key)
    }
  }
  return changed.sort()
}

function parseSectionFromKey(key: string): CatalogSection {
  const section = key.slice(0, key.indexOf(':')) as CatalogSection
  if (!catalogSections.includes(section)) throw new Error(`Unknown catalog section in key: ${key}`)
  return section
}

function getRowByKey(snapshot: SchemaSnapshot, key: string): CatalogRow | undefined {
  const section = parseSectionFromKey(key)
  return sectionMap(snapshot, section).get(key)
}

function normalizeSnapshot(input: unknown): SchemaSnapshot {
  let value = input
  if (typeof value === 'string') value = JSON.parse(value)
  if (Array.isArray(value)) value = value[0]
  if (value && typeof value === 'object' && 'schema_audit' in value) {
    value = (value as { schema_audit: unknown }).schema_audit
    if (typeof value === 'string') value = JSON.parse(value)
  }
  if (!value || typeof value !== 'object') throw new Error('Schema snapshot is not a JSON object')

  const record = value as Record<string, unknown>
  if (Number(record.format_version) !== 1) throw new Error('Unsupported schema snapshot format')
  for (const section of catalogSections) {
    if (!Array.isArray(record[section])) throw new Error(`Schema snapshot is missing ${section}`)
  }
  return record as unknown as SchemaSnapshot
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"'
        index += 1
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''))
      rows.push(row)
      row = []
      field = ''
    } else field += char
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''))
    rows.push(row)
  }
  return rows
}

export async function loadSchemaSnapshot(filePath: string): Promise<SchemaSnapshot> {
  const text = await readFile(filePath, 'utf8')
  try {
    return normalizeSnapshot(JSON.parse(text))
  } catch (jsonError) {
    const rows = parseCsv(text)
    if (rows.length >= 2 && rows[0][0]?.trim() === 'schema_audit') {
      return normalizeSnapshot(rows[1][0])
    }
    const detail = jsonError instanceof Error ? jsonError.message : String(jsonError)
    throw new Error(`Unable to parse schema snapshot as JSON or Supabase CSV export: ${detail}`)
  }
}

async function listMigrationFiles(repoRoot: string): Promise<MigrationFile[]> {
  const migrationDirectory = path.join(repoRoot, 'supabase', 'migrations')
  const names = (await readdir(migrationDirectory)).filter(name => /^\d{3}_.+\.sql$/.test(name)).sort()
  return names.map(name => ({
    version: name.slice(0, 3),
    name,
    absolutePath: path.join(migrationDirectory, name),
  }))
}

function pgliteCompatibleSql(sql: string): string {
  return sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto\s*;/gi, '')
}

async function prepareExpectedDatabase(): Promise<PGlite> {
  const database = new PGlite()
  await database.exec(`
    CREATE SCHEMA auth;
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN;
    CREATE TABLE auth.users (
      id uuid PRIMARY KEY,
      email text,
      email_confirmed_at timestamptz,
      created_at timestamptz DEFAULT now()
    );
    CREATE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
    CREATE FUNCTION auth.email() RETURNS text
      LANGUAGE sql STABLE AS $$ SELECT NULL::text $$;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets (
      id text PRIMARY KEY,
      name text,
      public boolean,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    CREATE SCHEMA supabase_migrations;
    CREATE TABLE supabase_migrations.schema_migrations (
      version text PRIMARY KEY,
      name text
    );
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
  `)
  return database
}

async function captureSnapshot(database: PGlite, catalogSql: string): Promise<SchemaSnapshot> {
  const result = await database.query<{ schema_audit: unknown }>(catalogSql)
  if (result.rows.length !== 1) throw new Error('Catalog query did not return exactly one row')
  const snapshot = normalizeSnapshot(result.rows[0].schema_audit)
  const lineEndingHashes = await database.query<{
    function_name: string
    identity_arguments: string
    source_hash_crlf: string
  }>(`
    SELECT procedure.proname AS function_name,
           pg_get_function_identity_arguments(procedure.oid) AS identity_arguments,
           md5(replace(procedure.prosrc, E'\\n', E'\\r\\n')) AS source_hash_crlf
    FROM pg_proc AS procedure
    JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.prokind IN ('f', 'p')
  `)
  const variants = new Map(lineEndingHashes.rows.map(row => [
    `${row.function_name}:${row.identity_arguments}`,
    row.source_hash_crlf,
  ]))
  for (const row of snapshot.functions) {
    row.source_hash_crlf = variants.get(`${row.function_name}:${row.identity_arguments}`)
  }
  return snapshot
}

export async function buildExpectedSchemaModel(
  repoRoot: string,
  catalogSql: string,
): Promise<ExpectedSchemaModel> {
  assertReadOnlyCatalogQuery(catalogSql)
  const files = await listMigrationFiles(repoRoot)
  const byVersion = new Map(files.map(file => [file.version, file]))

  for (const version of targetMigrationVersions) {
    if (!byVersion.has(version)) throw new Error(`Required migration ${version} is missing from the repository`)
  }
  for (const version of intentionallyExcludedVersions) {
    if (byVersion.has(version)) throw new Error(`Intentionally excluded migration ${version} unexpectedly exists`)
  }

  const database = await prepareExpectedDatabase()
  try {
    for (const file of files.filter(item => Number(item.version) <= 16)) {
      await database.exec(pgliteCompatibleSql(await readFile(file.absolutePath, 'utf8')))
    }
    const baseline = await captureSnapshot(database, catalogSql)
    const steps: MigrationStep[] = []
    let previous = baseline

    for (const version of targetMigrationVersions) {
      const file = byVersion.get(version)
      if (!file) throw new Error(`Required migration ${version} is missing`)
      await database.exec(pgliteCompatibleSql(await readFile(file.absolutePath, 'utf8')))
      const current = await captureSnapshot(database, catalogSql)
      steps.push({ version, name: file.name, changedKeys: changedKeys(previous, current) })
      previous = current
    }

    return {
      baseline,
      expected: previous,
      steps,
      repositoryMigrations: files.map(file => ({ version: file.version, name: file.name })),
    }
  } finally {
    await database.close()
  }
}

function rowFieldDifferences(section: CatalogSection, expected: CatalogRow, actual: CatalogRow): string[] {
  const [left, right] = comparisonPair(section, expected, actual)
  const fields = new Set([...Object.keys(left), ...Object.keys(right)])
  return [...fields].filter(field => JSON.stringify(left[field]) !== JSON.stringify(right[field])).sort()
}

function tableName(row: CatalogRow | undefined): string | null {
  return row?.table_name ? String(row.table_name) : null
}

function functionName(row: CatalogRow | undefined): string | null {
  return row?.function_name ? String(row.function_name) : null
}

export function compareSchemaSnapshots(
  model: ExpectedSchemaModel,
  actual: SchemaSnapshot,
): SchemaAuditReport {
  const lastTouched = new Map<string, string>()
  for (const step of model.steps) {
    for (const key of step.changedKeys) lastTouched.set(key, step.version)
  }

  const scope = new Set(lastTouched.keys())
  const touchedTables = new Set<string>()
  const touchedFunctions = new Set<string>()

  for (const key of scope) {
    const section = parseSectionFromKey(key)
    const expectedRow = getRowByKey(model.expected, key)
    const baselineRow = getRowByKey(model.baseline, key)
    if (tableSections.has(section)) {
      const name = tableName(expectedRow) ?? tableName(baselineRow)
      if (name) touchedTables.add(name)
    }
    if (functionSections.has(section)) {
      const name = functionName(expectedRow) ?? functionName(baselineRow)
      if (name) touchedFunctions.add(name)
    }
  }

  for (const section of catalogSections) {
    if (!tableSections.has(section) && !functionSections.has(section)) continue
    const union = new Map([
      ...sectionMap(model.expected, section),
      ...sectionMap(actual, section),
    ])
    for (const [key, row] of union) {
      if (tableSections.has(section) && row.table_name && touchedTables.has(String(row.table_name))) scope.add(key)
      if (functionSections.has(section) && row.function_name && touchedFunctions.has(String(row.function_name))) scope.add(key)
    }
  }

  const differences: SchemaDifference[] = []
  let matchingObjects = 0
  const resultByKey = new Map<string, 'matching' | SchemaDifference['kind']>()

  for (const key of [...scope].sort()) {
    const section = parseSectionFromKey(key)
    const expectedRow = getRowByKey(model.expected, key)
    const actualRow = getRowByKey(actual, key)
    const migration = lastTouched.get(key) ?? null
    if (expectedRow && !actualRow) {
      const difference: SchemaDifference = { section, key, migration, kind: 'missing' }
      differences.push(difference)
      resultByKey.set(key, 'missing')
    } else if (!expectedRow && actualRow) {
      const difference: SchemaDifference = { section, key, migration, kind: 'unexpected' }
      differences.push(difference)
      resultByKey.set(key, 'unexpected')
    } else if (expectedRow && actualRow) {
      const [comparableExpected, comparableActual] = comparisonPair(section, expectedRow, actualRow)
      const expectedFingerprint = createHash('sha256')
        .update(JSON.stringify(comparableExpected)).digest('hex').slice(0, 16)
      const actualFingerprint = createHash('sha256')
        .update(JSON.stringify(comparableActual)).digest('hex').slice(0, 16)
      if (expectedFingerprint !== actualFingerprint) {
        const difference: SchemaDifference = {
          section,
          key,
          migration,
          kind: 'conflicting',
          differing_fields: rowFieldDifferences(section, expectedRow, actualRow),
          expected_fingerprint: expectedFingerprint,
          actual_fingerprint: actualFingerprint,
        }
        differences.push(difference)
        resultByKey.set(key, 'conflicting')
      } else {
        matchingObjects += 1
        resultByKey.set(key, 'matching')
      }
    }
  }

  const ledgerVersions = new Set(actual.migrations.map(row => String(row.version).padStart(3, '0')))
  const migrationStatus: MigrationStatus[] = model.steps.map(step => {
    const finalKeys = [...lastTouched.entries()]
      .filter(([, version]) => version === step.version)
      .map(([key]) => key)
    const results = finalKeys.map(key => ({
      result: resultByKey.get(key) ?? 'matching',
      expected: getRowByKey(model.expected, key),
      actual: getRowByKey(actual, key),
    }))
    const matching = results.filter(item => item.result === 'matching').length
    const missing = results.filter(item => item.result === 'missing').length
    const unexpected = results.filter(item => item.result === 'unexpected').length
    const conflicting = results.filter(item => item.result === 'conflicting').length
    const recorded = ledgerVersions.has(step.version)
    const creationAnchors = finalKeys.filter(key => {
      const section = parseSectionFromKey(key)
      return (section === 'tables' || section === 'functions')
        && getRowByKey(model.expected, key)
        && !getRowByKey(model.baseline, key)
    })
    const presentCreationAnchors = creationAnchors.filter(key => getRowByKey(actual, key)).length
    let structureStatus: MigrationStatus['structure_status']
    if (results.length === 0) structureStatus = 'superseded'
    else if (missing === 0 && unexpected === 0 && conflicting === 0) {
      structureStatus = recorded ? 'applied_recorded' : 'applied_unrecorded'
    } else if (creationAnchors.length > 0 && presentCreationAnchors === 0) {
      structureStatus = recorded ? 'recorded_but_missing' : 'pending'
    } else {
      const expectedObjects = results.filter(item => item.expected).length
      const presentExpectedObjects = results.filter(item => item.expected && item.actual).length
      if (expectedObjects > 0 && presentExpectedObjects === 0 && unexpected === 0 && conflicting === 0) {
        structureStatus = recorded ? 'recorded_but_missing' : 'pending'
      } else structureStatus = 'partial_or_conflicting'
    }
    return {
      version: step.version,
      name: step.name,
      ledger_recorded: recorded,
      structure_status: structureStatus,
      matching_objects: matching,
      missing_objects: missing,
      unexpected_objects: unexpected,
      conflicting_objects: conflicting,
    }
  })

  const repositoryVersions = new Set(model.repositoryMigrations.map(item => item.version))
  const excludedMigrationStatus = intentionallyExcludedVersions.map(version => {
    const repositoryFilePresent = repositoryVersions.has(version)
    const ledgerRecorded = ledgerVersions.has(version)
    return {
      version,
      repository_file_present: repositoryFilePresent,
      ledger_recorded: ledgerRecorded,
      status: repositoryFilePresent
        ? 'unexpected_repository_file' as const
        : ledgerRecorded
          ? 'excluded_but_recorded' as const
          : 'excluded' as const,
    }
  })

  const countStatus = (status: MigrationStatus['structure_status']) =>
    migrationStatus.filter(item => item.structure_status === status).length

  const securityFindings: SchemaAuditReport['security_findings'] = []
  for (const functionRow of actual.functions) {
    const name = String(functionRow.function_name)
    if (!touchedFunctions.has(name) || functionRow.security_definer !== true) continue
    const identityArguments = String(functionRow.identity_arguments ?? '')
    const identity = `public.${name}(${identityArguments})`
    const roles = actual.function_grants
      .filter(grant =>
        grant.function_name === functionRow.function_name
        && grant.identity_arguments === functionRow.identity_arguments
        && grant.privilege_type === 'EXECUTE',
      )
      .map(grant => String(grant.grantee))
      .sort()
    const untrustedRoles = roles.filter(role => role === 'PUBLIC' || role === 'anon')
    if (untrustedRoles.length > 0) {
      securityFindings.push({
        severity: 'high',
        code: 'security_definer_untrusted_execute',
        function: identity,
        roles: untrustedRoles,
      })
    } else if (roles.includes('authenticated')) {
      securityFindings.push({
        severity: 'warning',
        code: 'security_definer_authenticated_execute',
        function: identity,
        roles: ['authenticated'],
      })
    }

    const configuration = Array.isArray(functionRow.configuration)
      ? functionRow.configuration.map(String)
      : []
    const searchPath = configuration.find(item => item.startsWith('search_path='))
    if (!searchPath) {
      securityFindings.push({
        severity: 'high',
        code: 'security_definer_missing_search_path',
        function: identity,
      })
    } else if (!/^search_path=pg_catalog(?:,|$)/.test(searchPath)) {
      securityFindings.push({
        severity: 'warning',
        code: 'security_definer_mutable_search_path',
        function: identity,
        configuration: [searchPath],
      })
    }
  }

  return {
    format_version: 1,
    generated_at: new Date().toISOString(),
    safety: {
      catalog_query_read_only: true,
      application_rows_read: false,
      expected_schema_target: 'in-memory-pglite-only',
      connected_database_mutated: false,
    },
    summary: {
      matching_objects: matchingObjects,
      missing_objects: differences.filter(item => item.kind === 'missing').length,
      unexpected_objects: differences.filter(item => item.kind === 'unexpected').length,
      conflicting_objects: differences.filter(item => item.kind === 'conflicting').length,
      applied_recorded_migrations: countStatus('applied_recorded'),
      applied_unrecorded_migrations: countStatus('applied_unrecorded'),
      pending_migrations: countStatus('pending'),
      recorded_but_missing_migrations: countStatus('recorded_but_missing'),
      partial_or_conflicting_migrations: countStatus('partial_or_conflicting'),
    },
    migration_status: migrationStatus,
    excluded_migration_status: excludedMigrationStatus,
    differences,
    security_findings: securityFindings.sort((left, right) =>
      left.severity.localeCompare(right.severity)
      || left.function.localeCompare(right.function)
      || left.code.localeCompare(right.code),
    ),
    limitations: [
      'The expected schema is materialized in PGlite; pgcrypto extension creation is skipped because PGlite does not ship that extension. Extension installation and extension-owned objects are not compared.',
      'Supabase-managed auth and storage internals are represented only by minimal local stubs. Their managed schema, policies, hooks, and grants are out of scope.',
      'Object comments, default privileges, event triggers, and column-level grants are not compared. Function owners are compared; ownership for other object classes is not yet included.',
      'Function source is compared by a one-way hash of pg_proc.prosrc; source code, tokens, and function arguments are not emitted in the report.',
      'pg_get_constraintdef, pg_get_indexdef, policy expressions, and trigger definitions can differ cosmetically between PostgreSQL versions. Such differences are reported as conflicts and require review; they are never assumed equivalent.',
      'Migration status is structural evidence plus the Supabase ledger. A structurally matching but unrecorded migration is reported as applied_unrecorded, not silently treated as ledger-applied.',
    ],
  }
}

export function summarizeExpectedModel(model: ExpectedSchemaModel): Record<string, unknown> {
  return {
    target_migrations: model.steps.map(step => ({
      version: step.version,
      name: step.name,
      changed_catalog_objects: step.changedKeys.length,
    })),
    intentionally_excluded_migrations: intentionallyExcludedVersions,
    expected_catalog_counts: Object.fromEntries(
      catalogSections.map(section => [section, relevantRows(section, model.expected[section]).length]),
    ),
  }
}
