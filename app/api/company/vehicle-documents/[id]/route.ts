import { handleWrite } from "@/app/api/company/guard";
import { removeVehiclePaper, updateVehiclePaper } from "@/lib/company/records";
import { parsePaperUpdate } from "@/lib/company/validate";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: Context) {
  const { id } = await context.params;
  return handleWrite("vehicles.write", async ({ companyId }, body) => {
    await updateVehiclePaper(companyId, id, parsePaperUpdate(body));
  }, req);
}

export async function DELETE(_req: Request, context: Context) {
  const { id } = await context.params;
  return handleWrite("vehicles.write", async ({ companyId }) => {
    await removeVehiclePaper(companyId, id);
  });
}
