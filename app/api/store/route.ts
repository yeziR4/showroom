import { NextResponse } from "next/server";
import { fetchStore } from "@/lib/shopify";
import { listRecords } from "@/lib/models";

export async function GET(req: Request) {
  const domain = new URL(req.url).searchParams.get("domain");
  if (!domain) return NextResponse.json({ error: "domain is required" }, { status: 400 });
  try {
    const store = await fetchStore(domain);
    const models = await listRecords((r) => r.domain === store.domain);
    return NextResponse.json({ store, models });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
