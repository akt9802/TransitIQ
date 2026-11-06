import { NextResponse } from "next/server";
import { OTP_COOKIE, SESSION_COOKIE } from "@/lib/auth/tokens";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
  res.cookies.set(OTP_COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
