import { handleWrite } from "@/app/api/company/guard";
import { revokeApiKey } from "@/lib/company/records";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, context: Context) {
  const { id } = await context.params;
  return handleWrite("company.write", async ({ companyId }) => {
    await revokeApiKey(companyId, id);
  });
}
