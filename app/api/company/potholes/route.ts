import { NextResponse } from "next/server";
import { requireMember, saved } from "@/app/api/company/guard";
import { ownPotholes, reportPothole, roadCondition } from "@/lib/company/roads";

export async function GET() {
  try {
    const access = await requireMember();
    if ("error" in access) return access.error;
    const { company, owner } = access.workspace;
    if (owner.roleKey === "driver") {
      if (!owner.driverId) return NextResponse.json({ monthPoints: 0, monthRupees: 0, earlierPoints: 0, reports: [] });
      return NextResponse.json(await ownPotholes(company.id, owner.driverId));
    }
    if (owner.roleKey !== "road_authority") {
      return NextResponse.json({ error: "You cannot view these reports" }, { status: 403 });
    }
    return NextResponse.json(await roadCondition());
  } catch (error) {
    return saved(error, "roads");
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireMember();
    if ("error" in access) return access.error;
    const { company, owner } = access.workspace;
    if (owner.roleKey !== "driver" || !owner.driverId) {
      return NextResponse.json({ error: "You cannot report this" }, { status: 403 });
    }
    const form = await req.formData();
    const latitude = Number(form.get("latitude"));
    const longitude = Number(form.get("longitude"));
    const photo = form.get("photo");
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: "Location is required" }, { status: 400 });
    }
    if (!(photo instanceof File)) {
      return NextResponse.json({ error: "Photo is required" }, { status: 400 });
    }
    const bytes = Buffer.from(await photo.arrayBuffer());
    const result = await reportPothole(company.id, owner.driverId, latitude, longitude, bytes);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return saved(error, "roads");
  }
}
