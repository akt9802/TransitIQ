import { handleWrite } from "@/app/api/company/guard";
import { removeDriverPaper } from "@/lib/company/records";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, context: Context) {
  const { id } = await context.params;
  return handleWrite("drivers.write", async ({ companyId }) => {
    await removeDriverPaper(companyId, id);
  });
}
