import { NextResponse } from "next/server";
import { searchProducts, SEED_STORES, prettyName } from "@/lib/shopify";
import { listRecords } from "@/lib/models";

// Uploads, Lux3D calls and multi-store fetches can take a while on serverless.
export const maxDuration = 60;

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (!q) {
    return NextResponse.json({ stores: SEED_STORES.map((d) => ({ domain: d, name: prettyName(d) })) });
  }
  const products = await searchProducts(q);
  const ids = new Set(products.map((p) => p.id));
  const models = await listRecords((r) => ids.has(r.id));
  return NextResponse.json({ products, models });
}
