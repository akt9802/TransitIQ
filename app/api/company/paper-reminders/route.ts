import { NextResponse } from "next/server";
import { requireMember } from "@/app/api/company/guard";
import { paperNotices } from "@/lib/company/papers";
import { formatPgError } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const access = await requireMember();
    if ("error" in access) return access.error;
    if (access.workspace.owner.roleKey === "driver") {
      return NextResponse.json({ banner: [], push: [] });
    }
    const claim = new URL(req.url).searchParams.get("claim") === "1";
    const notices = await paperNotices(access.workspace.company.id, claim);
    return NextResponse.json(notices);
  } catch (error) {
    console.error("GET /api/company/paper-reminders", error);
    return NextResponse.json({ error: formatPgError(error) }, { status: 500 });
  }
}
