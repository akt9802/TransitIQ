import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { parseOtpPurpose } from "@/lib/auth/otp";
import { ensureAuthSchema } from "@/lib/auth/schema";
import { formatPgError, getPool } from "@/lib/db";
import { sendOtpEmail } from "@/lib/mail";

const OTP_EXPIRY_MIN = 10;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; purpose?: string };
    const email = body.email?.trim().toLowerCase();
    const purpose = parseOtpPurpose(body.purpose);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    await ensureAuthSchema();
    const pool = getPool();

    const { rows: users } = await pool.query<{ id: string; password_hash: string | null }>(
      `SELECT id, password_hash FROM fleet_users WHERE email = $1`,
      [email]
    );
    const hasAccount = Boolean(users[0]?.password_hash);

    if (purpose === "signup" && hasAccount) {
      return NextResponse.json(
        {
          exists: true,
          error: "An account already exists for this email. Sign in with your password.",
        },
        { status: 409 }
      );
    }

    if (purpose === "reset" && !hasAccount) {
      return NextResponse.json({
        ok: true,
        delivered: true,
        message: "If that email is registered, we sent a reset code.",
      });
    }

    const code = String(randomInt(100000, 1000000));
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MIN * 60 * 1000);

    await pool.query(`DELETE FROM email_otps WHERE email = $1`, [email]);
    await pool.query(
      `INSERT INTO email_otps (email, code_hash, expires_at, purpose) VALUES ($1, $2, $3, $4)`,
      [email, codeHash, expiresAt, purpose]
    );

    const mail = await sendOtpEmail(email, code, purpose);

    if (!mail.delivered) {
      return NextResponse.json({
        ok: true,
        delivered: false,
        message:
          "Code saved, but email did not send. Check the Next.js terminal for the 6-digit code.",
      });
    }

    return NextResponse.json({
      ok: true,
      delivered: true,
      message:
        purpose === "reset"
          ? "If that email is registered, we sent a reset code."
          : "If that email is reachable, we sent a verification code.",
    });
  } catch (e) {
    console.error("request-otp", e);
    const message = formatPgError(e) || "Failed to send code";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
