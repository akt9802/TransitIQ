import { handleWrite } from "@/app/api/company/guard";
import { addAttendance } from "@/lib/company/records";
import { parseAttendance } from "@/lib/company/validate";

export async function POST(req: Request) {
  return handleWrite("drivers.write", async ({ companyId }, body) => {
    await addAttendance(companyId, parseAttendance(body));
  }, req, 201);
}
