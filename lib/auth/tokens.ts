import jwt from "jsonwebtoken";
import { OTP_COOKIE, SESSION_COOKIE } from "@/lib/auth/cookies";
import type { OtpPurpose } from "@/lib/auth/otp";

export { OTP_COOKIE, SESSION_COOKIE };

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set in .env.local");
  return s;
}

export type OtpTokenPayload = { email: string; typ: "otp_ok"; purpose: OtpPurpose };

export function signOtpToken(email: string, purpose: OtpPurpose = "signup"): string {
  return jwt.sign(
    { email, typ: "otp_ok", purpose } satisfies OtpTokenPayload,
    secret(),
    { expiresIn: "15m" }
  );
}

export function verifyOtpToken(token: string): OtpTokenPayload {
  const p = jwt.verify(token, secret()) as OtpTokenPayload;
  if (p.typ !== "otp_ok" || !p.email) throw new Error("Invalid token");
  return { ...p, purpose: p.purpose === "reset" ? "reset" : "signup" };
}

export type SessionPayload = { sub: string; email: string; typ: "session" };

export function signSession(userId: string, email: string): string {
  return jwt.sign(
    { sub: userId, email, typ: "session" } satisfies SessionPayload,
    secret(),
    { expiresIn: "7d" }
  );
}

export function verifySession(token: string): SessionPayload {
  const p = jwt.verify(token, secret()) as SessionPayload;
  if (p.typ !== "session" || !p.sub || !p.email) throw new Error("Invalid session");
  return p;
}
