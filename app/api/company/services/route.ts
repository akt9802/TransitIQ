import { handleWrite } from "@/app/api/company/guard";
import { parseService } from "@/lib/company/service-input";
import { addService } from "@/lib/company/services";

export async function POST(req: Request) {
  return handleWrite("vehicles.write", async ({ companyId }, body) => {
    await addService(companyId, parseService(body));
  }, req, 201);
}
