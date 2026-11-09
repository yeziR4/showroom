import { NextResponse } from "next/server";
import { createMaterialTransfer, uploadBuffer, uploadFromUrl } from "@/lib/lux3d";
import { getRecord, putRecord } from "@/lib/models";

// Uploads, Lux3D calls and multi-store fetches can take a while on serverless.
export const maxDuration = 60;

// Colour / material variants: repaint an existing product model with a material swatch.
export async function POST(req: Request) {
  const { parentId, label, swatch } = (await req.json()) as { parentId: string; label: string; swatch: string };
  const parent = await getRecord(parentId);
  if (!parent?.glb) return NextResponse.json({ error: "Generate the 3D model first" }, { status: 400 });
  const id = `variant/${parentId}/${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const existing = await getRecord(id);
  if (existing && existing.status !== "failed") return NextResponse.json({ record: existing });
  try {
    // Swatch is either a URL or a data: URL (generated colour chip / uploaded photo).
    let img: string;
    if (swatch.startsWith("data:")) {
      const [meta, b64] = swatch.split(",");
      img = await uploadBuffer(Buffer.from(b64, "base64"), `swatch.${meta.includes("png") ? "png" : "jpg"}`);
    } else {
      img = await uploadFromUrl(swatch);
    }
    const taskId = await createMaterialTransfer(parent.glb, img);
    const rec = await putRecord({
      id, kind: "variant", taskId, status: "queued", parentId, label,
      title: `${parent.title} — ${label}`, domain: parent.domain, price: parent.price, url: parent.url,
      image: parent.image, createdAt: Date.now(), updatedAt: Date.now(),
    });
    return NextResponse.json({ record: rec });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
