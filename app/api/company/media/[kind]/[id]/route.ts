import { NextResponse } from "next/server";
import { requireMember } from "@/app/api/company/guard";
import { costImage } from "@/lib/company/costs";
import { fuelImage } from "@/lib/company/fuel";
import { potholeImage } from "@/lib/company/roads";
import { proofImage } from "@/lib/company/proofs";

type Context = { params: Promise<{ kind: string; id: string }> };

export async function GET(_req: Request, context: Context) {
  const { kind, id } = await context.params;
  try {
    const access = await requireMember();
    if ("error" in access) return access.error;
    const known = kind === "proof" || kind === "fuel" || kind === "cost" || kind === "pothole";
    if (!/^[0-9a-f-]{36}$/i.test(id) || !known) {
      return NextResponse.json({ error: "Photo was not found" }, { status: 404 });
    }
    const companyId = access.workspace.company.id;
    const role = access.workspace.owner.roleKey;
    if (kind === "pothole" && role !== "driver" && role !== "road_authority") {
      return NextResponse.json({ error: "Photo was not found" }, { status: 404 });
    }
    const driverId = role === "driver"
      ? (access.workspace.owner.driverId ?? "00000000-0000-0000-0000-000000000000")
      : null;
    const bytes =
      kind === "proof"
        ? await proofImage(companyId, id)
        : kind === "fuel"
          ? await fuelImage(companyId, id)
          : kind === "cost"
            ? await costImage(companyId, id)
            : await potholeImage(id, driverId);
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
