import { handleWrite } from "@/app/api/company/guard";
import { emailTrackingLink, requestOrigin } from "@/lib/company/tracking-link";

type Context = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: Context) {
  const { id } = await context.params;
  return handleWrite("trips.write", async ({ companyId }) => {
    return emailTrackingLink({ companyId, tripId: id, origin: requestOrigin(req) });
  }, req);
}
