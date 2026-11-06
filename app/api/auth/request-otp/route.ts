import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ensureAuthSchema } from "@/lib/auth/schema";
import { formatPgError, getPool } from "@/lib/db";
import { sendOtpEmail } from "@/lib/mail";

const OTP_EXPIRY_MIN = 10;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    await ensureAuthSchema();
    const pool = getPool();

    const code = String(randomInt(100000, 1000000));
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MIN * 60 * 1000);

    await pool.query(`DELETE FROM email_otps WHERE email = $1`, [email]);
    await pool.query(
      `INSERT INTO email_otps (email, code_hash, expires_at) VALUES ($1, $2, $3)`,
      [email, codeHash, expiresAt]
    );

    const mail = await sendOtpEmail(email, code);

    if (!mail.delivered) {
      return NextResponse.json({
        ok: true,
        delivered: false,
        message:
          "Code saved, but email did not send (SMTP login rejected). Check the Next.js terminal for the 6-digit code, then replace SMTP_PASS with a new Brevo SMTP key.",
      });
    }

    return NextResponse.json({
      ok: true,
      delivered: true,
      message: "If that email is reachable, we sent a verification code.",
    });
  } catch (e) {
    console.error("request-otp", e);
    const message = formatPgError(e) || "Failed to send code";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
