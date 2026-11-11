import { NextResponse } from "next/server";
import { getRecord, isShowcased, listRecords, refresh } from "@/lib/models";

export const dynamic = "force-dynamic";

// The public showcase: every model built on the site, newest first.
//   ?limit=12&offset=0   paging
//   ?kind=product        only one kind
//   ?id=...              also include this record even if it isn't public (your own build)
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const id = sp.get("id");
  const kind = sp.get("kind");
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit") ?? 100)));
  const offset = Math.max(0, Number(sp.get("offset") ?? 0));

  // Builds whose visitor left before they finished are still "queued" in storage.
  // Finish a few of them here so they still reach the showcase.
  const stale = await listRecords((r) => (r.status === "queued" || r.status === "running") && Date.now() - r.createdAt > 20_000 && Date.now() - r.createdAt < 6 * 3600_000);
  await Promise.all(stale.slice(0, 5).map((r) => refresh(r.id)));

  const all = await listRecords((r) => isShowcased(r) && (!kind || r.kind === kind));
  // Newest builds first; committed examples after live ones.
  all.sort((a, b) => Number(!!a.example) - Number(!!b.example) || b.createdAt - a.createdAt);
  const page = all.slice(offset, offset + limit);
  if (id && !page.some((m) => m.id === id)) {
    const own = await getRecord(id);
    if (own?.status === "succeeded" && !own.hidden) page.unshift(own);
  }
  return NextResponse.json({ models: page, total: all.length });
}
