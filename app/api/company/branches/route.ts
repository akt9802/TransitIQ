import { handleWrite } from "@/app/api/company/guard";
import { addBranch } from "@/lib/company/records";
import { parseBranch } from "@/lib/company/validate";

export async function POST(req: Request) {
  return handleWrite("branches.write", async ({ companyId }, body) => {
    await addBranch(companyId, parseBranch(body));
  }, req, 201);
}
