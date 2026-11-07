import { NextResponse } from "next/server";
import { ensureAuthSchema } from "@/lib/auth/schema";
import { getSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/company/queries";
import type { Workspace } from "@/lib/company/types";
import { formatPgError } from "@/lib/db";

export async function requireFleet(permission: string) {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Sign in required" }, { status: 401 }) };
  }
  await ensureAuthSchema();
  const workspace = await getWorkspace(session.sub);
  if (!workspace) {
    return { error: NextResponse.json({ error: "Account not found" }, { status: 404 }) };
  }
  if (!workspace.company) {
    return { error: NextResponse.json({ error: "Set up your fleet first" }, { status: 400 }) };
  }
  if (!workspace.permissions.includes(permission)) {
    return { error: NextResponse.json({ error: "You can't change this" }, { status: 403 }) };
  }
  return { workspace: workspace as Workspace & { company: NonNullable<Workspace["company"]> } };
}

export function saved(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const isInput = /required|must be|should|not valid|Missing|already|Choose/.test(message);
  if (!isInput) console.error(fallback, error);
  return NextResponse.json(
    { error: isInput ? message : formatPgError(error) },
    { status: isInput ? 400 : 500 }
  );
}
