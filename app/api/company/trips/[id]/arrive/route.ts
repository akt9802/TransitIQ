import { NextResponse } from "next/server";
import { requireMember, saved } from "@/app/api/company/guard";
import { getPool } from "@/lib/db";
import { markStopReached } from "@/lib/company/trips";

type Context = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: Context) {
  const { id } = await context.params;
  try {
    const access = await requireMember();
    if ("error" in access) return access.error;
    const body = await req.json().catch(() => ({}));
    const raw = body as { latitude?: unknown; longitude?: unknown };
    const latitude = Number(raw.latitude);
    const longitude = Number(raw.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: "Location is required" }, { status: 400 });
    }
    const { company, owner, permissions } = access.workspace;
    if (!permissions.includes("trips.write")) {
      if (!owner.driverId) {
        return NextResponse.json({ error: "You can't change this" }, { status: 403 });
      }
      const own = await getPool().query(
        `SELECT 1 FROM trips
         WHERE id = $1 AND company_id = $2 AND driver_id = $3 AND deleted_at IS NULL`,
        [id, company.id, owner.driverId]
      );
      if (!own.rowCount) {
        return NextResponse.json({ error: "That trip is not assigned to you" }, { status: 403 });
      }
    }
    await markStopReached(company.id, id, { latitude, longitude });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return saved(error, "trips.write");
  }
}
