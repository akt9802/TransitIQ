import { NextResponse } from "next/server";
import { requireFleet, saved } from "@/app/api/company/guard";
import { ensureAuthSchema } from "@/lib/auth/schema";
import { getSession } from "@/lib/auth/session";
import { addPerson } from "@/lib/company/people";
import { getWorkspace } from "@/lib/company/queries";
import { parsePersonInput } from "@/lib/company/validate";
import { formatPgError } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    await ensureAuthSchema();
    const workspace = await getWorkspace(session.sub);
    if (!workspace) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    if (!workspace.permissions.includes("people.read")) {
      return NextResponse.json({ error: "You can't view people" }, { status: 403 });
    }
    return NextResponse.json({ people: workspace.people });
  } catch (error) {
    console.error("GET /api/company/people", error);
    return NextResponse.json({ error: formatPgError(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireFleet("people.write");
    if ("error" in access) return access.error;
    const input = parsePersonInput(await req.json());
    await addPerson(access.workspace.company.id, input);
    const workspace = await getWorkspace(access.workspace.owner.id);
    return NextResponse.json({ people: workspace?.people ?? [] }, { status: 201 });
  } catch (error) {
    return saved(error, "POST /api/company/people");
  }
}
