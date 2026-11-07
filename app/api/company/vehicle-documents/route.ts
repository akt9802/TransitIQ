import { handleWrite } from "@/app/api/company/guard";
import { addVehiclePaper } from "@/lib/company/records";
import { parseVehiclePaper } from "@/lib/company/validate";

export async function POST(req: Request) {
  return handleWrite("vehicles.write", async ({ companyId }, body) => {
    await addVehiclePaper(companyId, parseVehiclePaper(body));
  }, req, 201);
}
