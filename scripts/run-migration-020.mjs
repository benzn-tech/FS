/**
 * Run migration 020 only.
 *
 * Usage:
 *   node scripts/run-migration-020.mjs "<connection-string>"
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
  console.error('Usage: node scripts/run-migration-020.mjs "<connection-string>"')
  process.exit(1)
}

const cleanConn = connString.replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '')
const pool = new Pool({ connectionString: cleanConn, ssl: { rejectUnauthorized: false } })
const file = join(__dirname, '../migrations/020_fix_short_ready_sessions.sql')
const sql = readFileSync(file, 'utf8')

console.log('→ 020_fix_short_ready_sessions.sql')
try {
  const result = await pool.query(sql)
  console.log(`  ✓ done — ${result.rowCount} session(s) marked SKIPPED`)
} catch (err) {
  console.error(`  ✗ FAILED: ${err.message}`)
  await pool.end()
  process.exit(1)
}

await pool.end()
console.log('\nDone.')
