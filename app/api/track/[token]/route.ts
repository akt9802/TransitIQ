import { NextResponse } from "next/server";
import { customerTracking } from "@/lib/company/tracking-link";

type Context = { params: Promise<{ token: string }> };

export async function GET(_req: Request, context: Context) {
  const { token } = await context.params;
  const view = await customerTracking(token);
  if (!view) return NextResponse.json({ error: "This link was not found" }, { status: 404 });
  return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
}
