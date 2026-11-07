import { NextResponse } from "next/server";
import { requireMember } from "@/app/api/company/guard";
import { costImage } from "@/lib/company/costs";
import { fuelImage } from "@/lib/company/fuel";
import { proofImage } from "@/lib/company/proofs";

type Context = { params: Promise<{ kind: string; id: string }> };

export async function GET(_req: Request, context: Context) {
  const { kind, id } = await context.params;
  try {
    const access = await requireMember();
    if ("error" in access) return access.error;
    if (!/^[0-9a-f-]{36}$/i.test(id) || (kind !== "proof" && kind !== "fuel" && kind !== "cost")) {
      return NextResponse.json({ error: "Photo was not found" }, { status: 404 });
    }
    const companyId = access.workspace.company.id;
    const bytes =
      kind === "proof" ? await proofImage(companyId, id) : kind === "fuel" ? await fuelImage(companyId, id) : await costImage(companyId, id);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Photo was not found" }, { status: 404 });
  }
}
