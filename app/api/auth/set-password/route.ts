import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ensureAuthSchema } from "@/lib/auth/schema";
import { getPool } from "@/lib/db";
import { OTP_COOKIE, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/cookies";
import { signSession, verifyOtpToken } from "@/lib/auth/tokens";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(OTP_COOKIE)?.value;
    if (!token) {
      return NextResponse.json({ error: "Verify email OTP first" }, { status: 401 });
    }

    let email: string;
    let purpose: "signup" | "reset";
    try {
      ({ email, purpose } = verifyOtpToken(token));
    } catch {
      return NextResponse.json({ error: "OTP session expired — request a new code" }, { status: 401 });
    }

    const body = (await req.json()) as { password?: string };
    const password = body.password;
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    await ensureAuthSchema();
    const pool = getPool();

    const hash = await bcrypt.hash(password, 12);

    let userId: string | undefined;
    if (purpose === "reset") {
      const { rows } = await pool.query<{ id: string }>(
        `UPDATE fleet_users SET password_hash = $1, updated_at = now() WHERE email = $2 RETURNING id`,
        [hash, email]
      );
      userId = rows[0]?.id;
      if (!userId) {
        return NextResponse.json({ error: "No account found for this email" }, { status: 400 });
      }
    } else {
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO fleet_users (email, password_hash)
         VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now()
         RETURNING id`,
        [email, hash]
      );
      userId = rows[0]?.id;
    }

    if (!userId) {
      return NextResponse.json({ error: "Could not save user" }, { status: 500 });
    }

    const session = signSession(userId, email);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(OTP_COOKIE, "", { maxAge: 0, path: "/" });
    res.cookies.set(SESSION_COOKIE, session, sessionCookieOptions());
    return res;
  } catch (e) {
    console.error("set-password", e);
    const message = e instanceof Error ? e.message : "Failed to save password";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
