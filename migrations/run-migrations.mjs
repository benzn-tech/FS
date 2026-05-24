/**
 * run-migrations.mjs
 *
 * Runs SQL migration files against the target database.
 *
 * Usage:
 *   # Apply all pending migrations
 *   node migrations/run-migrations.mjs "<connection-string>"
 *
 *   # Roll back the last N migrations (runs NNN_down_*.sql in reverse order)
 *   node migrations/run-migrations.mjs "<connection-string>" --down <N>
 *
 * Examples:
 *   node migrations/run-migrations.mjs "postgres://user:pass@host:5432/db"
 *   node migrations/run-migrations.mjs "postgres://user:pass@host:5432/db" --down 1
 */
import { createRequire } from 'module'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const { Pool } = require('pg')

const __dirname = dirname(fileURLToPath(import.meta.url))
const [connString, flag, flagValue] = process.argv.slice(2)

if (!connString) {
  console.error('Usage: node migrations/run-migrations.mjs "<connection-string>" [--down <N>]')
  process.exit(1)
}

const pool = new Pool({ connectionString: connString, ssl: { rejectUnauthorized: false } })

async function run(files) {
  for (const file of files) {
    const sql = readFileSync(join(__dirname, file), 'utf8')
    console.log(`→ ${file}`)
    try {
      await pool.query(sql)
      console.log(`  ✓ done`)
    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}`)
      await pool.end()
      process.exit(1)
    }
  }
}

if (flag === '--down') {
  const n = parseInt(flagValue ?? '1', 10)
  if (isNaN(n) || n < 1) {
    console.error('--down requires a positive integer, e.g. --down 1')
    process.exit(1)
  }

  // Down files: NNN_down_*.sql, sorted descending so highest version runs first
  const downFiles = readdirSync(__dirname)
    .filter(f => f.match(/^\d+_down_.+\.sql$/))
    .sort()
    .reverse()
    .slice(0, n)

  if (downFiles.length === 0) {
    console.log('No down migration files found.')
    await pool.end()
    process.exit(0)
  }

  console.log(`Rolling back ${downFiles.length} migration(s)...\n`)
  await run(downFiles)
} else {
  // Up migrations: NNN_create_*.sql (excludes rollback and down files), sorted ascending
  const upFiles = readdirSync(__dirname)
    .filter(f => f.match(/^\d+_(?!down_|rollback).+\.sql$/))
    .sort()

  if (upFiles.length === 0) {
    console.log('No migration files found.')
    await pool.end()
    process.exit(0)
  }

  console.log(`Running ${upFiles.length} migration(s)...\n`)
  await run(upFiles)
}

await pool.end()
console.log('\nDone.')
