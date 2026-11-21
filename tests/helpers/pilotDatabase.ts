import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const migrationDirectory = path.join(repoRoot, 'supabase', 'migrations')

function pgliteCompatibleSql(sql: string): string {
  return sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto\s*;/gi, '')
}

export async function migrationFiles(through: number): Promise<string[]> {
  return (await readdir(migrationDirectory))
    .filter((name) => /^\d{3}_.+\.sql$/.test(name) && Number(name.slice(0, 3)) <= through)
    .sort()
}

export async function applyMigration(database: PGlite, name: string): Promise<void> {
  const sql = pgliteCompatibleSql(await readFile(path.join(migrationDirectory, name), 'utf8'))
  await database.exec('BEGIN')
  try {
    await database.exec(sql)
    await database.exec('COMMIT')
  } catch (error) {
    await database.exec('ROLLBACK')
    throw error
  }
}

export async function createDatabase(through = 33): Promise<PGlite> {
  const database = new PGlite()
  await database.exec(await readFile(path.join(repoRoot, 'tests/sql/localSupabase.sql'), 'utf8'))
  for (const name of await migrationFiles(through)) await applyMigration(database, name)
  return database
}
