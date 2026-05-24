/**
 * Run migration 018 only.
 *
 * Usage:
 *   node scripts/run-migration-018.mjs "<connection-string>"
 */
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const { Pool } = require('pg')

const __dirname = dirname(fileURLToPath(import.meta.url))
const connString = process.argv[2]

if (!connString) {
  console.error('Usage: node scripts/run-migration-018.mjs "<connection-string>"')
  process.exit(1)
}

// Strip sslmode from connection string — we set SSL options directly
const cleanConn = connString.replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '')
const pool = new Pool({ connectionString: cleanConn, ssl: { rejectUnauthorized: false } })
const file = join(__dirname, '../migrations/018_project_tasks_tag_assignee.sql')
const sql = readFileSync(file, 'utf8')

console.log('→ 018_project_tasks_tag_assignee.sql')
try {
  await pool.query(sql)
  console.log('  ✓ done')
} catch (err) {
  console.error(`  ✗ FAILED: ${err.message}`)
  await pool.end()
  process.exit(1)
}

await pool.end()
console.log('\nDone.')
