import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertReadOnlyCatalogQuery,
  buildExpectedSchemaModel,
  compareSchemaSnapshots,
  loadSchemaSnapshot,
  summarizeExpectedModel,
} from './schema-audit/core'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalogPath = path.join(repoRoot, 'scripts', 'schema-audit', 'catalog.sql')

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function printHelp(): void {
  console.log(`Usage:
  npm run schema:audit:check
  npm run schema:audit -- --snapshot <supabase-export.json|csv> [--output <report.json>]
  npx tsx scripts/schema-audit.ts --query

The catalog query is a single read-only SELECT over PostgreSQL metadata. The
comparison target is built in an isolated in-memory PGlite database. No command
in this tool connects to Supabase or executes migration SQL against Supabase.`)
}

async function main(): Promise<void> {
  const catalogSql = await readFile(catalogPath, 'utf8')
  assertReadOnlyCatalogQuery(catalogSql)

  if (process.argv.includes('--query')) {
    console.log(JSON.stringify({
      catalog_query: catalogPath,
      read_only_validation: 'passed',
      application_rows_read: false,
    }, null, 2))
    return
  }

  const model = await buildExpectedSchemaModel(repoRoot, catalogSql)
  if (process.argv.includes('--check')) {
    console.log(JSON.stringify({
      read_only_catalog_query: 'passed',
      expected_schema_build: 'passed',
      ...summarizeExpectedModel(model),
    }, null, 2))
    return
  }

  const snapshotPath = option('--snapshot')
  if (!snapshotPath) {
    printHelp()
    process.exitCode = 2
    return
  }

  const actual = await loadSchemaSnapshot(path.resolve(snapshotPath))
  const report = compareSchemaSnapshots(model, actual)
  const output = `${JSON.stringify(report, null, 2)}\n`
  const outputPath = option('--output')
  if (outputPath) {
    const resolvedOutput = path.resolve(outputPath)
    await writeFile(resolvedOutput, output, { encoding: 'utf8', flag: 'wx' })
    console.log(JSON.stringify({
      report: resolvedOutput,
      summary: report.summary,
    }, null, 2))
  } else console.log(output)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
