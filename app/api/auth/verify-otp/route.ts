import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ensureAuthSchema } from "@/lib/auth/schema";
import { getPool } from "@/lib/db";
import { OTP_COOKIE, signOtpToken } from "@/lib/auth/tokens";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; code?: string };
    const email = body.email?.trim().toLowerCase();
    const code = body.code?.trim();
    if (!email || !code) {
      return NextResponse.json({ error: "Email and code required" }, { status: 400 });
    }

    await ensureAuthSchema();
    const pool = getPool();

    const { rows } = await pool.query<{ code_hash: string }>(
      `SELECT code_hash FROM email_otps
       WHERE email = $1 AND consumed_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`,
      [email]
    );

    if (rows.length === 0 || !(await bcrypt.compare(code, rows[0].code_hash))) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    await pool.query(
      `UPDATE email_otps SET consumed_at = now() WHERE email = $1 AND consumed_at IS NULL`,
      [email]
    );

    const token = signOtpToken(email);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(OTP_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60,
      path: "/",
    });
    return res;
  } catch (e) {
    console.error("verify-otp", e);
    const message = e instanceof Error ? e.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
