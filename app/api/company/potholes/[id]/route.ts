import { NextResponse } from "next/server";
import { requireMember, saved } from "@/app/api/company/guard";
import { reviewPothole } from "@/lib/company/roads";

type Context = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: Context) {
  const { id } = await context.params;
  try {
    const access = await requireMember();
    if ("error" in access) return access.error;
    if (access.workspace.owner.roleKey !== "road_authority") {
      return NextResponse.json({ error: "You cannot review this" }, { status: 403 });
    }
    const body = (await req.json().catch(() => null)) as { action?: string } | null;
    const action = body?.action;
    if (action !== "approve" && action !== "reject" && action !== "fix") {
      return NextResponse.json({ error: "Choose approve, reject, or fixed" }, { status: 400 });
    }
    const result = await reviewPothole(id, action);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return saved(error, "roads");
  }
}
