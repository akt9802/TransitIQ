import { NextResponse } from "next/server";
import { requireFleet, saved } from "@/app/api/company/guard";
import { updatePerson } from "@/lib/company/people";
import { getWorkspace } from "@/lib/company/queries";
import { parsePersonInput } from "@/lib/company/validate";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: Context) {
  try {
    const access = await requireFleet("people.write");
    if ("error" in access) return access.error;
    const { id } = await context.params;
    const input = parsePersonInput(await req.json());
    const result = await updatePerson(access.workspace.company.id, id, input);
    if (result === "missing") {
      return NextResponse.json({ error: "That person is not in this fleet" }, { status: 404 });
    }
    if (result === "owner") {
      return NextResponse.json(
        { error: "Edit the owner from the company section" },
        { status: 400 }
      );
    }
    const workspace = await getWorkspace(access.workspace.owner.id);
    return NextResponse.json({ people: workspace?.people ?? [] });
  } catch (error) {
    return saved(error, "PATCH /api/company/people");
  }
}
