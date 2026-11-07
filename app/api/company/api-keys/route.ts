import { handleWrite } from "@/app/api/company/guard";
import { createApiKey } from "@/lib/company/records";
import { parseApiKeyName } from "@/lib/company/validate";

export async function POST(req: Request) {
  return handleWrite("company.write", async ({ companyId }, body) => {
    const secret = await createApiKey(companyId, parseApiKeyName(body));
    return { secret };
  }, req, 201);
}
