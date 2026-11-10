import { NextResponse } from "next/server";
import { formatPgError, getPool } from "@/lib/db";

/**
 * GET /api/health/db — returns Postgres connectivity (server-side only).
 * Remove or protect in production if you don't want this exposed.
 */
export async function GET() {
  try {
    const pool = getPool();
    const {
      rows: [row],
    } = await pool.query<{ version: string }>("SELECT version() AS version");
    return NextResponse.json({
      ok: true,
      version: row?.version ?? null,
    });
  } catch (e) {
    const message = formatPgError(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
