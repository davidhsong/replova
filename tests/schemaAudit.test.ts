import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test, { before } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  assertReadOnlyCatalogQuery,
  buildExpectedSchemaModel,
  compareSchemaSnapshots,
  type ExpectedSchemaModel,
  type SchemaSnapshot,
} from '../scripts/schema-audit/core'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalogPath = path.join(repoRoot, 'scripts', 'schema-audit', 'catalog.sql')

let catalogSql: string
let model: ExpectedSchemaModel

before(async () => {
  catalogSql = await readFile(catalogPath, 'utf8')
  model = await buildExpectedSchemaModel(repoRoot, catalogSql)
})

function cloneSnapshot(snapshot: SchemaSnapshot): SchemaSnapshot {
  return structuredClone(snapshot)
}

function withoutPlaybook(snapshot: SchemaSnapshot): SchemaSnapshot {
  const output = cloneSnapshot(snapshot)
  const isPlaybookTable = (row: Record<string, unknown>) =>
    String(row.table_name ?? '').startsWith('playbook_')
  const isPlaybookFunction = (row: Record<string, unknown>) => {
    const name = String(row.function_name ?? '')
    return name.startsWith('playbook_') || name === 'set_playbook_updated_at'
  }

  output.tables = output.tables.filter(row => !isPlaybookTable(row))
  output.columns = output.columns.filter(row => !isPlaybookTable(row))
  output.constraints = output.constraints.filter(row => !isPlaybookTable(row))
  output.indexes = output.indexes.filter(row =>
    !isPlaybookTable(row) && row.index_name !== 'api_usage_log_operation_created_idx',
  )
  output.policies = output.policies.filter(row => !isPlaybookTable(row))
  output.table_grants = output.table_grants.filter(row => !isPlaybookTable(row))
  output.triggers = output.triggers.filter(row => !isPlaybookTable(row))
  output.functions = output.functions.filter(row => !isPlaybookFunction(row))
  output.function_grants = output.function_grants.filter(row => !isPlaybookFunction(row))
  return output
}

test('catalog inspection is one read-only metadata query', () => {
  assert.doesNotThrow(() => assertReadOnlyCatalogQuery(catalogSql))
  assert.throws(
    () => assertReadOnlyCatalogQuery('WITH target AS (SELECT 1) DELETE FROM accounts;'),
    /not read-only/i,
  )
  assert.throws(
    () => assertReadOnlyCatalogQuery('SELECT * FROM pg_catalog.pg_class; SELECT 1;'),
    /exactly one/i,
  )
})

test('expected catalog materializes migrations 017-033 while keeping 026 absent', () => {
  assert.deepEqual(
    model.steps.map(step => step.version),
    ['017', '018', '019', '020', '021', '022', '023', '024', '025', '027', '028', '029', '030', '031', '032', '033'],
  )
  assert.ok(model.steps.find(step => step.version === '029')?.changedKeys.length)
  assert.ok(model.steps.find(step => step.version === '031')?.changedKeys.length)
  const hardeningStep = model.steps.find(step => step.version === '032')
  assert.ok(hardeningStep?.changedKeys.length)
  assert.equal(
    hardeningStep?.changedKeys.every(key =>
      key.startsWith('functions:') || key.startsWith('function_grants:'),
    ),
    true,
  )
  const legacyHardeningStep = model.steps.find(step => step.version === '033')
  assert.ok(legacyHardeningStep?.changedKeys.length)
  assert.ok(legacyHardeningStep?.changedKeys.some(key =>
    key.startsWith('tables:') && key.includes('api_budget_state'),
  ))
  assert.ok(legacyHardeningStep?.changedKeys.some(key =>
    key.startsWith('columns:') && key.includes('review_requests'),
  ))
  assert.equal(model.repositoryMigrations.some(item => item.version === '026'), false)
  assert.equal(
    model.expected.tables.some(row => row.table_name === 'google_business_connections'),
    true,
  )
  assert.equal(
    model.expected.tables.some(row => row.table_name === 'playbook_procedures'),
    true,
  )
  assert.equal(
    model.expected.functions.every(row => typeof row.owner_name === 'string'),
    true,
  )
})

test('comparison distinguishes applied-unrecorded 029, excluded 026, and pending 031', () => {
  const productionLike = withoutPlaybook(model.expected)
  productionLike.migrations = Array.from({ length: 17 }, (_, version) => ({
    version: String(version).padStart(3, '0'),
    name: `migration_${String(version).padStart(3, '0')}`,
  }))

  const report = compareSchemaSnapshots(model, productionLike)
  const migration029 = report.migration_status.find(item => item.version === '029')
  const migration031 = report.migration_status.find(item => item.version === '031')

  assert.equal(migration029?.ledger_recorded, false)
  assert.equal(migration029?.structure_status, 'applied_unrecorded')
  assert.equal(migration031?.ledger_recorded, false)
  assert.equal(migration031?.structure_status, 'pending')
  assert.deepEqual(report.excluded_migration_status, [{
    version: '026',
    repository_file_present: false,
    ledger_recorded: false,
    status: 'excluded',
  }])
  assert.deepEqual(report.safety, {
    catalog_query_read_only: true,
    application_rows_read: false,
    expected_schema_target: 'in-memory-pglite-only',
    connected_database_mutated: false,
  })
  assert.equal(
    report.security_findings.some(finding =>
      finding.code === 'security_definer_untrusted_execute'
      || finding.code === 'security_definer_mutable_search_path',
    ),
    false,
  )
  assert.deepEqual(
    report.security_findings
      .filter(finding => finding.code === 'security_definer_authenticated_execute')
      .map(finding => finding.function.slice(0, finding.function.indexOf('(')))
      .sort(),
    [
      'public.current_user_owns_replova_account',
      'public.current_user_owns_replova_workspace',
      'public.owns_restaurant',
      'public.owns_youtube_connection',
    ],
  )
})

test('function source differences are detected without exposing function source', () => {
  const actual = cloneSnapshot(model.expected)
  const target = actual.functions.find(row => row.function_name === 'consume_google_business_oauth_state')
  assert.ok(target)
  target.source_hash = '00000000000000000000000000000000'
  const report = compareSchemaSnapshots(model, actual)
  const difference = report.differences.find(item =>
    item.key.includes('consume_google_business_oauth_state'),
  )
  assert.equal(difference?.kind, 'conflicting')
  assert.ok(difference?.differing_fields?.includes('source_hash'))
  assert.equal(JSON.stringify(report).includes('oauth_state_invalid_expired_or_replayed'), false)
})
