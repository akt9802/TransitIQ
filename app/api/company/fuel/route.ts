import { NextResponse } from "next/server";
import { requireMember, saved } from "@/app/api/company/guard";
import { addFuel, listFuel } from "@/lib/company/fuel";

export async function GET() {
  try {
    const access = await requireMember();
    if ("error" in access) return access.error;
    const { company, owner, permissions } = access.workspace;
    if (!permissions.includes("trips.read")) {
      return NextResponse.json({ error: "You cannot change this" }, { status: 403 });
    }
    const onlyDriver = owner.roleKey === "driver" ? owner.driverId : null;
    if (owner.roleKey === "driver" && !onlyDriver) {
      return NextResponse.json({ fills: [], totalAmount: 0, totalLitres: 0 });
    }
    const fills = await listFuel(company.id, onlyDriver);
    const totalAmount = Math.round(fills.reduce((sum, fill) => sum + fill.amount, 0) * 100) / 100;
    const totalLitres = Math.round(fills.reduce((sum, fill) => sum + fill.litres, 0) * 1000) / 1000;
    return NextResponse.json({ fills, totalAmount, totalLitres });
  } catch (error) {
    return saved(error, "trips.read");
  }
}

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
    const litres = Number(form.get("litres"));
    const amount = Number(form.get("amount"));
    const details = String(form.get("details") ?? "");
    const latitude = Number(form.get("latitude"));
    const longitude = Number(form.get("longitude"));
    const photo = form.get("photo");
    if (!vehicleId) return NextResponse.json({ error: "Choose a truck" }, { status: 400 });
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: "Location is required" }, { status: 400 });
    }
    if (!(photo instanceof File)) {
      return NextResponse.json({ error: "Photo is required" }, { status: 400 });
    }
    const bytes = Buffer.from(await photo.arrayBuffer());
    const result = await addFuel({
      companyId: company.id,
      driverId: owner.driverId,
      vehicleId,
      tripId: tripValue || null,
      litres,
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
