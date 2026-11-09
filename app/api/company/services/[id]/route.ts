import { handleWrite } from "@/app/api/company/guard";
import { parseService } from "@/lib/company/service-input";
import { removeService, updateService } from "@/lib/company/services";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: Context) {
  const { id } = await context.params;
  return handleWrite("vehicles.write", async ({ companyId }, body) => {
    await updateService(companyId, id, parseService(body));
  }, req);
}

export async function DELETE(_req: Request, context: Context) {
  const { id } = await context.params;
  return handleWrite("vehicles.write", async ({ companyId }) => {
    await removeService(companyId, id);
  });
}
