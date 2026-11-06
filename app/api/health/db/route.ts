import { NextResponse } from "next/server";

/**
 * GET /api/health/db — returns Postgres connectivity (server-side only).
 * Remove or protect in production if you don't want this exposed.
 */
export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        ok: false,
        error: "DATABASE_URL is not configured",
      },
      { status: 503 }
    );
  }

  try {
    const { getPool } = await import("@/lib/db");
    const pool = getPool();
    const {
      rows: [row],
    } = await pool.query<{ version: string }>("SELECT version() AS version");
    return NextResponse.json({
      ok: true,
      version: row?.version ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
