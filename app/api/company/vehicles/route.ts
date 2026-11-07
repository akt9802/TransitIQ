import { NextResponse } from "next/server";
import { requireFleet, saved } from "@/app/api/company/guard";
import { ensureAuthSchema } from "@/lib/auth/schema";
import { getSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/company/queries";
import { parseVehicleInput, parseVehiclePapers } from "@/lib/company/validate";
import { addVehicle, vehicleLimitMessage } from "@/lib/company/vehicles";
import { formatPgError } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    await ensureAuthSchema();
    const workspace = await getWorkspace(session.sub);
    if (!workspace) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    if (!workspace.permissions.includes("vehicles.read")) {
      return NextResponse.json({ error: "You can't view trucks" }, { status: 403 });
    }
    return NextResponse.json({
      vehicles: workspace.vehicles,
      vehicleLimit: workspace.company?.vehicleLimit ?? 0,
    });
  } catch (error) {
    console.error("GET /api/company/vehicles", error);
    return NextResponse.json({ error: formatPgError(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireFleet("vehicles.write");
    if ("error" in access) return access.error;
    const body = await req.json();
    const input = parseVehicleInput(body);
    const result = await addVehicle(access.workspace.company.id, input, parseVehiclePapers(body));
    if (result === "limit") {
      return NextResponse.json(
        { error: vehicleLimitMessage(access.workspace.company.vehicleLimit) },
        { status: 400 }
      );
    }
    const workspace = await getWorkspace(access.workspace.owner.id);
    return NextResponse.json({ vehicles: workspace?.vehicles ?? [] }, { status: 201 });
  } catch (error) {
    return saved(error, "POST /api/company/vehicles");
  }
}
