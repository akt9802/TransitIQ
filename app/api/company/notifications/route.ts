import { handleWrite } from "@/app/api/company/guard";
import { saveNotifications } from "@/lib/company/records";
import { parseNotifications } from "@/lib/company/validate";

export async function PUT(req: Request) {
  return handleWrite(null, async ({ userId }, body) => {
    await saveNotifications(userId, parseNotifications(body));
  }, req);
}
