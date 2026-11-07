import { handleWrite } from "@/app/api/company/guard";
import { addDriverPaper } from "@/lib/company/records";
import { parseDriverPaper } from "@/lib/company/validate";

export async function POST(req: Request) {
  return handleWrite("drivers.write", async ({ companyId }, body) => {
    await addDriverPaper(companyId, parseDriverPaper(body));
  }, req, 201);
}
