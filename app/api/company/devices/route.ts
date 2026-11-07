import { handleWrite } from "@/app/api/company/guard";
import { addDevice } from "@/lib/company/records";
import { parseDeviceInput } from "@/lib/company/validate";

export async function POST(req: Request) {
  return handleWrite("devices.write", async ({ companyId }, body) => {
    await addDevice(companyId, parseDeviceInput(body));
  }, req, 201);
}
