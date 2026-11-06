import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/tokens";

export async function GET(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader
    .split(";")
    .find((c) => c.trim().startsWith(`${SESSION_COOKIE}=`));
  const raw = match?.split("=").slice(1).join("=").trim();
  if (!raw) {
    return NextResponse.json({ user: null });
  }
  try {
    const p = verifySession(raw);
    return NextResponse.json({ user: { id: p.sub, email: p.email } });
  } catch {
    return NextResponse.json({ user: null });
  }
}
