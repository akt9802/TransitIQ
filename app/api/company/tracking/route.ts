import { NextResponse } from "next/server";
import { requireMember, saved } from "@/app/api/company/guard";
import { trackingSnapshot } from "@/lib/company/tracking";

export async function GET() {
  try {
    const access = await requireMember();
    if ("error" in access) return access.error;
    const { company, owner, permissions } = access.workspace;
    if (!permissions.includes("trips.read")) {
      return NextResponse.json({ error: "You can't change this" }, { status: 403 });
    }
    const onlyDriver = permissions.includes("trips.write") ? null : owner.driverId;
    if (!permissions.includes("trips.write") && !onlyDriver) {
      return NextResponse.json({
        keptDays: 10,
        gapMinutes: 5,
        sleepTargetHours: 8,
        rows: [],
        trails: [],
      });
    }
    return NextResponse.json(await trackingSnapshot(company.id, onlyDriver));
  } catch (error) {
    return saved(error, "trips.read");
  }
}
