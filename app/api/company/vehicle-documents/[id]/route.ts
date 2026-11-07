import { handleWrite } from "@/app/api/company/guard";
import { removeVehiclePaper } from "@/lib/company/records";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, context: Context) {
  const { id } = await context.params;
  return handleWrite("vehicles.write", async ({ companyId }) => {
    await removeVehiclePaper(companyId, id);
  });
}
