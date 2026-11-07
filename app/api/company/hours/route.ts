import { handleWrite } from "@/app/api/company/guard";
import { addHos } from "@/lib/company/records";
import { parseHos } from "@/lib/company/validate";

export async function POST(req: Request) {
  return handleWrite("drivers.write", async ({ companyId }, body) => {
    await addHos(companyId, parseHos(body));
  }, req, 201);
}
