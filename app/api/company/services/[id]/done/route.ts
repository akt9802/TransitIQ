import { handleWrite } from "@/app/api/company/guard";
import { indiaToday } from "@/lib/company/paper-rules";
import { parseServiceDone } from "@/lib/company/service-input";
import { completeService } from "@/lib/company/services";

type Context = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: Context) {
  const { id } = await context.params;
  return handleWrite("vehicles.write", async ({ companyId }, body) => {
    const input = parseServiceDone(body);
    await completeService(companyId, id, input.doneOn ?? indiaToday(), input.odometerKm);
  }, req);
}
