import { NextResponse } from "next/server";
import { requireMember, saved } from "@/app/api/company/guard";
import { potholeAhead } from "@/lib/company/roads";

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(req: Request) {
  try {
    const access = await requireMember();
    if ("error" in access) return access.error;
    const { company, owner } = access.workspace;
    if (owner.roleKey !== "driver" || !owner.driverId) {
      return NextResponse.json({ text: null, potholeId: null });
    }
    const url = new URL(req.url);
    const latitude = Number(url.searchParams.get("latitude"));
    const longitude = Number(url.searchParams.get("longitude"));
    const tripId = url.searchParams.get("tripId") ?? "";
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !UUID.test(tripId)) {
      return NextResponse.json({ text: null, potholeId: null });
    }
    return NextResponse.json(await potholeAhead(company.id, owner.driverId, tripId, latitude, longitude));
  } catch (error) {
    return saved(error, "roads");
  }
}
