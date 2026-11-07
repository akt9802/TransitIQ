import { handleWrite } from "@/app/api/company/guard";
import { removeDevice, updateDevice } from "@/lib/company/records";
import { parseDeviceInput } from "@/lib/company/validate";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: Context) {
  const { id } = await context.params;
  return handleWrite("devices.write", async ({ companyId }, body) => {
    await updateDevice(companyId, id, parseDeviceInput(body));
  }, req);
}

export async function DELETE(_req: Request, context: Context) {
  const { id } = await context.params;
  return handleWrite("devices.write", async ({ companyId }) => {
    await removeDevice(companyId, id);
  });
}
