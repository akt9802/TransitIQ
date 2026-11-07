import { handleWrite } from "@/app/api/company/guard";
import { removeVendor, updateVendor } from "@/lib/company/records";
import { parseVendor } from "@/lib/company/validate";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: Context) {
  const { id } = await context.params;
  return handleWrite("vendors.write", async ({ companyId }, body) => {
    await updateVendor(companyId, id, parseVendor(body));
  }, req);
}

export async function DELETE(_req: Request, context: Context) {
  const { id } = await context.params;
  return handleWrite("vendors.write", async ({ companyId }) => {
    await removeVendor(companyId, id);
  });
}
