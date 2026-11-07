import { NextResponse } from "next/server";
import { customerProof } from "@/lib/company/tracking-link";

type Context = { params: Promise<{ token: string; id: string }> };

export async function GET(_req: Request, context: Context) {
  const { token, id } = await context.params;
  try {
    const bytes = await customerProof(token, id);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Photo was not found" }, { status: 404 });
  }
}
