import { ensureCompanySchema } from "@/lib/company/schema";
import { getPool } from "@/lib/db";

/** Run once per process; safe to call from API routes. */
let schemaReady = false;

export async function ensureAuthSchema(): Promise<void> {
  if (schemaReady) return;

  const pool = getPool();

  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fleet_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS email_otps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_email_otps_email ON email_otps(email);
    CREATE INDEX IF NOT EXISTS idx_email_otps_expires ON email_otps(expires_at);
  `);

  await pool.query(
    `ALTER TABLE email_otps ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'signup'`
  );

  await ensureCompanySchema();

  schemaReady = true;
}
