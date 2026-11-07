import { handleWrite } from "@/app/api/company/guard";
import { createTrip } from "@/lib/company/trips";
import { parseTripInput } from "@/lib/company/validate";

export async function POST(req: Request) {
  return handleWrite("trips.write", async ({ companyId }, body) => {
    await createTrip(companyId, parseTripInput(body));
  }, req, 201);
}
