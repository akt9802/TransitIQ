import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ensureAuthSchema } from "@/lib/auth/schema";
import { getPool } from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/cookies";
import { signSession } from "@/lib/auth/tokens";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    await ensureAuthSchema();
    const pool = getPool();

    const { rows } = await pool.query<{ id: string; password_hash: string | null }>(
      `SELECT id, password_hash FROM fleet_users WHERE email = $1`,
      [email]
    );

    const user = rows[0];
    if (!user?.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const session = signSession(user.id, email);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, session, sessionCookieOptions());
    return res;
  } catch (e) {
    console.error("login", e);
    const message = e instanceof Error ? e.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
