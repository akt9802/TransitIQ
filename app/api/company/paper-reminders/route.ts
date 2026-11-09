import { NextResponse } from "next/server";
import { requireMember } from "@/app/api/company/guard";
import { paperNotices, type PaperNotice } from "@/lib/company/papers";
import { serviceNotices } from "@/lib/company/services";
import { formatPgError } from "@/lib/db";

const OPEN_TRIP = new Set(["assigned", "started", "loading", "in_transit", "unloading"]);

export async function GET(req: Request) {
  try {
    const access = await requireMember();
    if ("error" in access) return access.error;
    const claim = new URL(req.url).searchParams.get("claim") === "1";
    const companyId = access.workspace.company.id;
    const driver = access.workspace.owner.roleKey === "driver";
    if (driver) {
      const vehicleIds = [...new Set(
        access.workspace.trips
          .filter((trip) => trip.vehicleId && OPEN_TRIP.has(trip.status) && trip.driverId === access.workspace.owner.driverId)
          .map((trip) => trip.vehicleId as string)
      )];
      const services = await serviceNotices(companyId, claim, vehicleIds, "/dashboard?section=trips");
      return NextResponse.json(services);
    }
    const [papers, services] = await Promise.all([
      paperNotices(companyId, claim),
      serviceNotices(companyId, claim, null, "/dashboard?section=vehicles"),
    ]);
    const banner = [...papers.banner, ...services.banner].sort(byDays);
    const push = [...papers.push, ...services.push];
    return NextResponse.json({ banner, push });
  } catch (error) {
    console.error("GET /api/company/paper-reminders", error);
    return NextResponse.json({ error: formatPgError(error) }, { status: 500 });
  }
}

function byDays(left: PaperNotice, right: PaperNotice) {
  return (left.days ?? 0.5) - (right.days ?? 0.5);
}
