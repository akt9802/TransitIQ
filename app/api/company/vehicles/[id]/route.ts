import { NextResponse } from "next/server";
import { requireFleet, saved } from "@/app/api/company/guard";
import { getWorkspace } from "@/lib/company/queries";
import { parseVehicleInput } from "@/lib/company/validate";
import { updateVehicle } from "@/lib/company/vehicles";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: Context) {
  try {
    const access = await requireFleet("vehicles.write");
    if ("error" in access) return access.error;
    const { id } = await context.params;
    const input = parseVehicleInput(await req.json());
    const updated = await updateVehicle(access.workspace.company.id, id, input);
    if (!updated) {
      return NextResponse.json({ error: "That truck is not in this fleet" }, { status: 404 });
    }
    const workspace = await getWorkspace(access.workspace.owner.id);
    return NextResponse.json({ vehicles: workspace?.vehicles ?? [] });
  } catch (error) {
    return saved(error, "PATCH /api/company/vehicles");
  }
}
