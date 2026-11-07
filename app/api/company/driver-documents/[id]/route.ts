import { handleWrite } from "@/app/api/company/guard";
import { removeDriverPaper, updateDriverPaper } from "@/lib/company/records";
import { parsePaperUpdate } from "@/lib/company/validate";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: Context) {
  const { id } = await context.params;
  return handleWrite("drivers.write", async ({ companyId }, body) => {
    await updateDriverPaper(companyId, id, parsePaperUpdate(body));
  }, req);
}

export async function DELETE(_req: Request, context: Context) {
  const { id } = await context.params;
  return handleWrite("drivers.write", async ({ companyId }) => {
    await removeDriverPaper(companyId, id);
  });
}
