import { handleWrite } from "@/app/api/company/guard";
import { removeBranch, updateBranch } from "@/lib/company/records";
import { parseBranch } from "@/lib/company/validate";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: Context) {
  const { id } = await context.params;
  return handleWrite("branches.write", async ({ companyId }, body) => {
    await updateBranch(companyId, id, parseBranch(body));
  }, req);
}

export async function DELETE(_req: Request, context: Context) {
  const { id } = await context.params;
  return handleWrite("branches.write", async ({ companyId }) => {
    await removeBranch(companyId, id);
  });
}
