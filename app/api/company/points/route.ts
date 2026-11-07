import { handleWrite } from "@/app/api/company/guard";
import { addPoints } from "@/lib/company/records";
import { parsePoints } from "@/lib/company/validate";

export async function POST(req: Request) {
  return handleWrite("drivers.write", async ({ companyId }, body) => {
    await addPoints(companyId, parsePoints(body));
  }, req, 201);
}
