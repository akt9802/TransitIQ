import { NextResponse } from "next/server";
import { requireMember, saved } from "@/app/api/company/guard";
import { recordLocation } from "@/lib/company/tracking";

export async function POST(req: Request) {
  try {
    const access = await requireMember();
    if ("error" in access) return access.error;
    const { owner } = access.workspace;
    if (!owner.driverId) {
      return NextResponse.json({ error: "You can't change this" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const raw = body as { tripId?: unknown; latitude?: unknown; longitude?: unknown };
    const tripId = typeof raw.tripId === "string" ? raw.tripId : "";
    const latitude = Number(raw.latitude);
    const longitude = Number(raw.longitude);
    if (!tripId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: "Location is required" }, { status: 400 });
    }
    const result = await recordLocation(access.workspace.company.id, owner.driverId, tripId, latitude, longitude);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return saved(error, "trips.write");
  }
}
