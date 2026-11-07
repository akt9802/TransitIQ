import { NextResponse } from "next/server";
import { requireMember, saved } from "@/app/api/company/guard";
import { addTripProof } from "@/lib/company/proofs";

type Context = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: Context) {
  const { id } = await context.params;
  try {
    const access = await requireMember();
    if ("error" in access) return access.error;
    const { company, owner } = access.workspace;
    if (!owner.driverId) {
      return NextResponse.json({ error: "You cannot change this" }, { status: 403 });
    }
    const form = await req.formData();
    const kind = form.get("kind");
    const latitude = Number(form.get("latitude"));
    const longitude = Number(form.get("longitude"));
    const photo = form.get("photo");
    if (kind !== "pickup" && kind !== "delivery") {
      return NextResponse.json({ error: "Photo kind is required" }, { status: 400 });
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: "Location is required" }, { status: 400 });
    }
    if (!(photo instanceof File)) {
      return NextResponse.json({ error: "Photo is required" }, { status: 400 });
    }
    const bytes = Buffer.from(await photo.arrayBuffer());
    const result = await addTripProof(company.id, owner.driverId, id, kind, latitude, longitude, bytes);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return saved(error, "trips.write");
  }
}
