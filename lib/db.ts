import { Pool, type PoolConfig, type QueryResultRow } from "pg";

/**
 * Server-only Postgres pool. Use from Route Handlers, Server Actions, or `getServerSideProps`-style data loading — not from client components.
 *
 * Set `DATABASE_URL` in `.env.local`, e.g.
 * `postgresql://USER:PASSWORD@localhost:5432/transitiq`
 */

const globalForPool = globalThis as unknown as { transitiqPgPool?: Pool };

function createPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local (see .env.example)."
    );
  }

  const config: PoolConfig = {
    connectionString: url,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  };

  return new Pool(config);
}

/** Singleton pool (survives Next.js dev hot reload). */
export function getPool(): Pool {
  if (!globalForPool.transitiqPgPool) {
    globalForPool.transitiqPgPool = createPool();
  }
  return globalForPool.transitiqPgPool;
}

export async function queryDb<
  T extends QueryResultRow = QueryResultRow,
>(text: string, params?: unknown[]): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query<T>(text, params);
  return result.rows;
}
