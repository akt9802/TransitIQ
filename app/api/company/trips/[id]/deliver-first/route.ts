import { handleWrite } from "@/app/api/company/guard";
import { deliverTripFirst, oilTripFirst } from "@/lib/company/services";

type Context = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: Context) {
  const { id } = await context.params;
  return handleWrite("trips.write", async ({ companyId }) => {
    await deliverTripFirst(companyId, id);
  });
}

export async function DELETE(_req: Request, context: Context) {
  const { id } = await context.params;
  return handleWrite("trips.write", async ({ companyId }) => {
    await oilTripFirst(companyId, id);
  });
}
