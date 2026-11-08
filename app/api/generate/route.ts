import { NextResponse } from "next/server";
import { createImageTo3D, createTextTo3D, uploadFromUrl, type Quality } from "@/lib/lux3d";
import { getRecord, putRecord, type ModelRecord } from "@/lib/models";

type Body =
  | {
      kind: "product";
      id: string;
      title: string;
      images: string[];
      domain?: string;
      price?: string;
      url?: string;
      quality?: Quality;
      angles?: number; // how many product photos to send (1–4)
      force?: boolean;
    }
  | { kind: "prompt"; prompt: string; style?: string };

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  try {
    if (body.kind === "prompt") {
      const prompt = body.prompt?.trim();
      if (!prompt) return NextResponse.json({ error: "prompt is required" }, { status: 400 });
      const id = `prompt/${prompt.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`;
      const existing = await getRecord(id);
      if (existing && existing.status !== "failed") return NextResponse.json({ record: existing });
      const taskId = await createTextTo3D(prompt, body.style);
      const rec = await putRecord({
        id, kind: "prompt", taskId, status: "queued", title: prompt,
        createdAt: Date.now(), updatedAt: Date.now(),
      });
      return NextResponse.json({ record: rec });
    }

    if (!body.id || !body.images?.length) {
      return NextResponse.json({ error: "id and images are required" }, { status: 400 });
    }
    const existing = await getRecord(body.id);
    if (existing && existing.status !== "failed" && !body.force) {
      return NextResponse.json({ record: existing });
    }
    const angles = Math.min(Math.max(body.angles ?? 1, 1), 4);
    const uploaded = await Promise.all(body.images.slice(0, angles).map(uploadFromUrl));
    const taskId = await createImageTo3D(uploaded, body.quality ?? "turbo");
    const rec: ModelRecord = {
      id: body.id, kind: "product", taskId, status: "queued",
      title: body.title, image: body.images[0], domain: body.domain,
      price: body.price, url: body.url,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    await putRecord(rec);
    return NextResponse.json({ record: rec });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
