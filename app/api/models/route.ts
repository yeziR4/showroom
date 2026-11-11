import { NextResponse } from "next/server";
import { getRecord, listRecords } from "@/lib/models";

export const dynamic = "force-dynamic";

// Everything built so far — powers the mall and the ad studio's product list.
// Visitors' uploaded photos are private: only returned when asked for by id.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const id = sp.get("id");
  const kind = sp.get("kind");
  const models = await listRecords((r) => r.status === "succeeded" && r.kind !== "photo" && (!kind || r.kind === kind));
  if (id && !models.some((m) => m.id === id)) {
    const own = await getRecord(id);
    if (own?.status === "succeeded") models.unshift(own);
  }
  return NextResponse.json({ models: models.slice(0, 100) });
}
