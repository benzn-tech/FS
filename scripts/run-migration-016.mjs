import { createRequire } from 'module'
import { readFileSync } from 'fs'
const require = createRequire(import.meta.url)
const { Pool } = require('pg')

const connString = process.argv[2]
if (!connString) { console.error('Pass connection string as argument'); process.exit(1) }

const pool = new Pool({ connectionString: connString, ssl: { rejectUnauthorized: false } })
const sql = readFileSync(new URL('../migrations/016_project_tasks.sql', import.meta.url), 'utf8')

try {
  await pool.query(sql)
  console.log('Done — project_tasks table created.')
} catch (e) {
  console.error('FAILED:', e.message)
} finally {
  await pool.end()
}
