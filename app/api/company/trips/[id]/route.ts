import { handleWrite } from "@/app/api/company/guard";
import { updateTrip } from "@/lib/company/trips";
import { parseTripInput } from "@/lib/company/validate";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: Context) {
  const { id } = await context.params;
  return handleWrite("trips.write", async ({ companyId }, body) => {
    await updateTrip(companyId, id, parseTripInput(body));
  }, req);
}
