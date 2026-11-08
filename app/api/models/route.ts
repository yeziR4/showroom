import { NextResponse } from "next/server";
import { listRecords } from "@/lib/models";

// Everything that has been turned into 3D so far — powers the mall's "freshly built" wall.
export async function GET(req: Request) {
  const kind = new URL(req.url).searchParams.get("kind");
  const models = await listRecords((r) => r.status === "succeeded" && (!kind || r.kind === kind));
  return NextResponse.json({ models: models.slice(0, 100) });
}
