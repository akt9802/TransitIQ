import { handleWrite } from "@/app/api/company/guard";
import { addDriver } from "@/lib/company/records";
import { parseDriverInput } from "@/lib/company/validate";

export async function POST(req: Request) {
  return handleWrite("drivers.write", async ({ companyId }, body) => {
    await addDriver(companyId, parseDriverInput(body));
  }, req, 201);
}
