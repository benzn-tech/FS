import { Pool, type PoolClient } from 'pg'

// ---------------------------------------------------------------------------
// Singleton pg Pool — reused across requests in the same process.
// In dev, Next.js hot-reloads create new module instances, so we attach
// the pool to the global object to avoid exhausting connections.
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  })
}

function getPool(): Pool {
  if (!globalThis.__pgPool) {
    globalThis.__pgPool = createPool()
  }
  return globalThis.__pgPool
}

export const db = new Proxy({} as Pool, {
  get(_target, prop) {
    return (getPool() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

// ---------------------------------------------------------------------------
// Typed query helper — infers the row shape from the generic parameter.
// Returns the rows array directly so callers don't need to destructure.
// ---------------------------------------------------------------------------
export async function query<T extends object = Record<string, unknown>>(
  sql: string,
  values?: unknown[],
): Promise<T[]> {
  const result = await db.query<T>(sql, values)
  return result.rows
}

// ---------------------------------------------------------------------------
// Single-row helper — returns the first row or null.
// ---------------------------------------------------------------------------
export async function queryOne<T extends object = Record<string, unknown>>(
  sql: string,
  values?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(sql, values)
  return rows[0] ?? null
}

// ---------------------------------------------------------------------------
// Transaction helper — runs callback inside a BEGIN/COMMIT block.
// Rolls back automatically if the callback throws.
// ---------------------------------------------------------------------------
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
