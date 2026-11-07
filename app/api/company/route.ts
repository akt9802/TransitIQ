import { NextResponse } from "next/server";
import { ensureAuthSchema } from "@/lib/auth/schema";
import { getSession } from "@/lib/auth/session";
import { createFleet, getWorkspace, updateFleet } from "@/lib/company/queries";
import { parseCompanyInput } from "@/lib/company/validate";
import { formatPgError } from "@/lib/db";

async function sessionUser() {
  const session = await getSession();
  if (!session) return null;
  await ensureAuthSchema();
  return session;
}

export async function GET() {
  try {
    const session = await sessionUser();
    if (!session) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const workspace = await getWorkspace(session.sub);
    if (!workspace) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    return NextResponse.json(workspace);
  } catch (error) {
    console.error("GET /api/company", error);
    return NextResponse.json({ error: formatPgError(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await sessionUser();
    if (!session) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const input = parseCompanyInput(await req.json());
    const result = await createFleet(session.sub, input);
    if (result === "exists") {
      return NextResponse.json(
        { error: "This account already belongs to a fleet" },
        { status: 409 }
      );
    }
    const workspace = await getWorkspace(session.sub);
    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create the fleet";
    const status = /required|must be|should|not valid|Missing/.test(message) ? 400 : 500;
    if (status === 500) console.error("POST /api/company", error);
    return NextResponse.json(
      { error: status === 400 ? message : formatPgError(error) },
      { status }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await sessionUser();
    if (!session) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const input = parseCompanyInput(await req.json());
    const updated = await updateFleet(session.sub, input);
    if (!updated) {
      return NextResponse.json({ error: "Set up your fleet first" }, { status: 400 });
    }
    const workspace = await getWorkspace(session.sub);
    return NextResponse.json(workspace);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the fleet";
    const status = /required|must be|should|not valid|Missing/.test(message) ? 400 : 500;
    if (status === 500) console.error("PATCH /api/company", error);
    return NextResponse.json(
      { error: status === 400 ? message : formatPgError(error) },
      { status }
    );
  }
}
