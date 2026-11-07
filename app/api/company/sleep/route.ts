import { NextResponse } from "next/server";
import { requireMember, saved } from "@/app/api/company/guard";
import { setSleep } from "@/lib/company/tracking";

export async function POST(req: Request) {
  try {
    const access = await requireMember();
    if ("error" in access) return access.error;
    const { owner } = access.workspace;
    if (!owner.driverId) {
      return NextResponse.json({ error: "You can't change this" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const action = (body as { action?: unknown }).action;
    if (action !== "start" && action !== "wake") {
      return NextResponse.json({ error: "Sleep action is required" }, { status: 400 });
    }
    await setSleep(access.workspace.company.id, owner.driverId, action === "wake");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return saved(error, "trips.write");
  }
}
