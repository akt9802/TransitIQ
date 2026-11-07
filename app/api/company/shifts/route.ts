import { handleWrite } from "@/app/api/company/guard";
import { addShift } from "@/lib/company/records";
import { parseShift } from "@/lib/company/validate";

export async function POST(req: Request) {
  return handleWrite("drivers.write", async ({ companyId }, body) => {
    await addShift(companyId, parseShift(body));
  }, req, 201);
}
