import { NextResponse } from "next/server";
import { ensureAuthSchema } from "@/lib/auth/schema";
import { getSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/company/queries";
import type { Workspace } from "@/lib/company/types";
import { formatPgError } from "@/lib/db";

type AccountAccess = { workspace: Workspace };
type FleetAccess = { workspace: Workspace & { company: NonNullable<Workspace["company"]> } };

async function loadAccount(): Promise<AccountAccess | { error: NextResponse }> {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Sign in required" }, { status: 401 }) };
  }
  await ensureAuthSchema();
  const workspace = await getWorkspace(session.sub);
  if (!workspace) {
    return { error: NextResponse.json({ error: "Account not found" }, { status: 404 }) };
  }
  return { workspace };
}

export async function requireAccount() {
  return loadAccount();
}

export async function requireMember() {
  const access = await loadAccount();
  if ("error" in access) return access;
  if (access.workspace.owner.roleKey === "road_authority") {
    return { error: NextResponse.json({ error: "You cannot view this fleet" }, { status: 403 }) };
  }
  if (!access.workspace.company) {
    return { error: NextResponse.json({ error: "Set up your fleet first" }, { status: 400 }) };
  }
  return { workspace: access.workspace as FleetAccess["workspace"] };
}

export async function requireFleet(permission: string) {
  const access = await requireMember();
  if ("error" in access) return access;
  if (!access.workspace.permissions.includes(permission)) {
    return { error: NextResponse.json({ error: "You can't change this" }, { status: 403 }) };
  }
  return access;
}

export async function handleWrite(
  permission: string | null,
  work: (ctx: { companyId: string; userId: string }, body: unknown) => Promise<unknown>,
  req?: Request,
  status = 200
) {
  try {
    const access = permission ? await requireFleet(permission) : await requireMember();
    if ("error" in access) return access.error;
    const body = req ? await req.json().catch(() => ({})) : {};
    const result = await work(
      { companyId: access.workspace.company.id, userId: access.workspace.owner.id },
      body
    );
    return NextResponse.json(result ?? { ok: true }, { status });
  } catch (error) {
    return saved(error, permission ?? "fleet");
  }
}

export function saved(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const isInput = /required|must be|should|not valid|Missing|already|Choose|not found|in use|linked|expired|cannot|not at|on leave|inactive|retired|maintenance/i.test(message);
  if (!isInput) console.error(fallback, error);
  return NextResponse.json(
    { error: isInput ? message : formatPgError(error) },
    { status: isInput ? 400 : 500 }
  );
}
