export const OTP_COOKIE = "transitiq_otp";
export const SESSION_COOKIE = "transitiq_session";

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  };
}
