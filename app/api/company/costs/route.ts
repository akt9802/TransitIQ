import { NextResponse } from "next/server";
import { requireMember, saved } from "@/app/api/company/guard";
import { addCost, COST_KINDS, type CostKind } from "@/lib/company/costs";

export async function POST(req: Request) {
  try {
    const access = await requireMember();
    if ("error" in access) return access.error;
    const { company, owner } = access.workspace;
    if (!owner.driverId) {
      return NextResponse.json({ error: "You cannot change this" }, { status: 403 });
    }
    const form = await req.formData();
    const vehicleId = String(form.get("vehicleId") ?? "");
    const tripValue = String(form.get("tripId") ?? "");
    const kind = String(form.get("kind") ?? "");
    const amount = Number(form.get("amount"));
    const details = String(form.get("details") ?? "");
    const latitude = Number(form.get("latitude"));
    const longitude = Number(form.get("longitude"));
    const photo = form.get("photo");
    if (!tripValue && !vehicleId) return NextResponse.json({ error: "Choose a truck" }, { status: 400 });
    if (!COST_KINDS.includes(kind as CostKind)) {
      return NextResponse.json({ error: "Choose what the cost was for" }, { status: 400 });
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: "Location is required" }, { status: 400 });
    }
    if (!(photo instanceof File)) {
      return NextResponse.json({ error: "Photo is required" }, { status: 400 });
    }
    const bytes = Buffer.from(await photo.arrayBuffer());
    const result = await addCost({
      companyId: company.id,
      driverId: owner.driverId,
      vehicleId,
      tripId: tripValue || null,
      kind: kind as CostKind,
      amount,
      details,
      latitude,
      longitude,
      bytes,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return saved(error, "trips.write");
  }
}
