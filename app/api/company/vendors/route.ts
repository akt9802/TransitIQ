import { handleWrite } from "@/app/api/company/guard";
import { addVendor } from "@/lib/company/records";
import { parseVendor } from "@/lib/company/validate";

export async function POST(req: Request) {
  return handleWrite("vendors.write", async ({ companyId }, body) => {
    await addVendor(companyId, parseVendor(body));
  }, req, 201);
}
