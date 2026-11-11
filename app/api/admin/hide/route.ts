import { NextResponse } from "next/server";
import { getRecord, putRecord } from "@/lib/models";

// Remove (or restore) a model from the public showcase.
//   GET /api/admin/hide?id=<model id>&key=<ADMIN_KEY>[&undo=1]
// Only works when ADMIN_KEY is set in the environment.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const key = process.env.ADMIN_KEY;
  if (!key || sp.get("key") !== key) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const id = sp.get("id");
  const rec = id ? await getRecord(id) : undefined;
  if (!rec) return NextResponse.json({ error: "not found" }, { status: 404 });
  rec.hidden = sp.get("undo") !== "1";
  rec.updatedAt = Date.now();
  await putRecord(rec);
  return NextResponse.json({ ok: true, id: rec.id, hidden: rec.hidden });
}
