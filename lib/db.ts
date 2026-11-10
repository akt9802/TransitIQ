import { Pool, type PoolConfig, type QueryResultRow } from "pg";
import { attachQueryTiming } from "@/lib/db-timing";

/**
 * Server-only Postgres pool. Set one of:
 * - `DATABASE_URL` — full URI from Supabase → Connect, or
 * - `SUPABASE_DB_PASSWORD` + `NEXT_PUBLIC_SUPABASE_URL` (+ `SUPABASE_DB_REGION` and optional `SUPABASE_POOLER_HOST`)
 *
 * Local `next dev` uses the session pooler (port 5432) and keeps only a few connections.
 * Vercel sets `VERCEL` and uses the transaction pooler (port 6543) with one connection per
 * instance. Session mode on the free project allows 15 clients total, so a pool of 10 on
 * every serverless instance hits `EMAXCONNSESSION`.
 *
 * Do not guess the pooler host. `aws-0-<region>` is not a safe default (cluster index + region
 * must match Connect). Wrong region → FATAL tenant/user not found.
 */

const POOL_REVISION = 7;

const globalForPool = globalThis as unknown as {
  transitiqPgPool?: Pool;
  transitiqPgConn?: string;
  transitiqPgRev?: number;
};

/** Supabase project ref from `https://xxxxx.supabase.co` */
function parseSupabaseProjectRef(supabaseUrl: string): string {
  const host = new URL(supabaseUrl).hostname;
  const match = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
  if (!match) throw new Error(`Unexpected Supabase URL host: ${host}`);
  return match[1];
}

/**
 * Direct host `db.<ref>.supabase.co` often has **IPv6-only** DNS (AAAA). Node/pg on many networks
 * resolves A first → ENOTFOUND. The **shared pooler** is IPv4.
 * Transaction mode (6543) is required on Vercel. Session mode (5432) is for the local process.
 */
function poolerPort(): 5432 | 6543 {
  return process.env.VERCEL ? 6543 : 5432;
}

function buildSupabasePoolerUrl(
  projectRef: string,
  password: string,
  region: string,
  port: 5432 | 6543 = poolerPort()
): string {
  const user = encodeURIComponent(`postgres.${projectRef}`);
  const pass = encodeURIComponent(password);
  const host =
    process.env.SUPABASE_POOLER_HOST?.trim() || `aws-0-${region}.pooler.supabase.com`;
  return `postgresql://${user}:${pass}@${host}:${port}/postgres`;
}

function normalizeSupabaseDirectUrl(url: string): string {
  const region = process.env.SUPABASE_DB_REGION?.trim();
  if (!region) return url;

  try {
    const u = new URL(url);
    const m = u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
    if (!m) return url;
    const ref = m[1];
    const password =
      u.password !== "" ? decodeURIComponent(u.password) : process.env.SUPABASE_DB_PASSWORD ?? "";
    if (!password) return url;
    return buildSupabasePoolerUrl(ref, password, region, poolerPort());
  } catch {
    return url;
  }
}

/** A pasted session-pooler URI stays on 5432 unless this rewrites it for Vercel. */
function useTransactionPooler(url: string): string {
  if (!process.env.VERCEL) return url;
  return url.replace(/(\.pooler\.supabase\.com):5432(?=\/|[?#]|$)/, "$1:6543");
}

function resolveConnectionString(): string {
  const direct = process.env.DATABASE_URL?.trim();
  if (direct) {
    return useTransactionPooler(normalizeSupabaseDirectUrl(direct));
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const dbPassword = process.env.SUPABASE_DB_PASSWORD?.trim();
  const region = process.env.SUPABASE_DB_REGION?.trim();

  if (supabaseUrl && dbPassword) {
    try {
      const projectRef = parseSupabaseProjectRef(supabaseUrl);
      if (region) {
        return buildSupabasePoolerUrl(projectRef, dbPassword, region, poolerPort());
      }
      const user = encodeURIComponent("postgres");
      const pass = encodeURIComponent(dbPassword);
      return `postgresql://${user}:${pass}@db.${projectRef}.supabase.co:5432/postgres`;
    } catch (e) {
      throw new Error(
        `Could not build DATABASE_URL from NEXT_PUBLIC_SUPABASE_URL: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  throw new Error(
    [
      "Postgres is not configured.",
      "Add DATABASE_URL to .env.local (Supabase → Project Settings → Database → Connection string → URI),",
      "or set SUPABASE_DB_PASSWORD with your database password alongside NEXT_PUBLIC_SUPABASE_URL.",
      "See .env.example.",
    ].join(" ")
  );
}

function createPool(): Pool {
  const connectionString = resolveConnectionString();
  const serverless = Boolean(process.env.VERCEL);

  const config: PoolConfig = {
    connectionString,
    max: serverless ? 1 : 3,
    idleTimeoutMillis: serverless ? 5_000 : 20_000,
    connectionTimeoutMillis: 15_000,
    allowExitOnIdle: true,
    ssl:
      connectionString.includes("supabase.co") ||
      connectionString.includes("pooler.supabase.com") ||
      connectionString.includes("neon.tech") ||
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
  };

  return attachQueryTiming(new Pool(config));
}

/** Singleton pool (survives Next.js dev hot reload; rebuilt if the URI changes). */
export function getPool(): Pool {
  const connectionString = resolveConnectionString();
  if (
    !globalForPool.transitiqPgPool ||
    globalForPool.transitiqPgConn !== connectionString ||
    globalForPool.transitiqPgRev !== POOL_REVISION
  ) {
    if (globalForPool.transitiqPgPool) {
      void globalForPool.transitiqPgPool.end().catch(() => undefined);
    }
    globalForPool.transitiqPgPool = createPool();
    globalForPool.transitiqPgConn = connectionString;
    globalForPool.transitiqPgRev = POOL_REVISION;
  }
  return globalForPool.transitiqPgPool;
}

/** Pooler tenant errors look like credential failures; they are almost always the wrong host/region. */
export function formatPgError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (/tenant\/user .+ not found/i.test(message)) {
    return [
      message,
      "The shared pooler could not find this project on that host.",
      "Copy Session pooler from Supabase → Connect (region + aws-0 vs aws-1 must match; do not guess).",
    ].join(" ");
  }
  return message;
}

export async function queryDb<
  T extends QueryResultRow = QueryResultRow,
>(text: string, params?: unknown[]): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query<T>(text, params);
  return result.rows;
}
