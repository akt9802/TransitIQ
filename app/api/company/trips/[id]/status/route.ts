import { NextResponse } from "next/server";
import { requireMember, saved } from "@/app/api/company/guard";
import { getPool } from "@/lib/db";
import { changeTripStatus } from "@/lib/company/trips";
import { parseTripStatus } from "@/lib/company/validate";

type Context = { params: Promise<{ id: string }> };

const DRIVER_STEPS = new Set(["started", "loading", "in_transit", "unloading", "completed", "assigned"]);

function hereFrom(body: unknown): { latitude: number; longitude: number } | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as { latitude?: unknown; longitude?: unknown };
  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

export async function POST(req: Request, context: Context) {
  const { id } = await context.params;
  try {
    const access = await requireMember();
    if ("error" in access) return access.error;
    const body = await req.json().catch(() => ({}));
    const status = parseTripStatus(body);
    const { company, owner, permissions } = access.workspace;
    const writer = permissions.includes("trips.write");
    if (!writer) {
      if (!owner.driverId || !DRIVER_STEPS.has(status)) {
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
    await changeTripStatus(company.id, id, status, {
      here: hereFrom(body),
      enforcePlace: !writer,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return saved(error, "trips.write");
  }
}
