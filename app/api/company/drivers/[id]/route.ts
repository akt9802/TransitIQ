import { handleWrite } from "@/app/api/company/guard";
import { removeDriver, updateDriver } from "@/lib/company/records";
import { parseDriverInput } from "@/lib/company/validate";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: Context) {
  const { id } = await context.params;
  return handleWrite("drivers.write", async ({ companyId }, body) => {
    await updateDriver(companyId, id, parseDriverInput(body));
  }, req);
}

export async function DELETE(_req: Request, context: Context) {
  const { id } = await context.params;
  return handleWrite("drivers.write", async ({ companyId }) => {
    await removeDriver(companyId, id);
  });
}
