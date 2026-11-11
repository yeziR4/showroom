import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createImageTo3D, createTextTo3D, uploadBuffer, uploadFromUrl, type Quality } from "@/lib/lux3d";
import { getRecord, putRecord, type ModelRecord } from "@/lib/models";
import { QuotaError, spendBuild } from "@/lib/quota";

// Uploads, Lux3D calls and multi-store fetches can take a while on serverless.
export const maxDuration = 60;

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
  | { kind: "prompt"; prompt: string; style?: string }
  // A photo the visitor uploads, already resized in the browser (data: URL).
  | { kind: "photo"; image: string; title?: string };

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  try {
    if (body.kind === "prompt") {
      const prompt = body.prompt?.trim();
      if (!prompt) return NextResponse.json({ error: "prompt is required" }, { status: 400 });
      const id = `prompt/${prompt.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`;
      const existing = await getRecord(id);
      if (existing && existing.status !== "failed") return NextResponse.json({ record: existing });
      await spendBuild(req);
      const taskId = await createTextTo3D(prompt, body.style);
      const rec = await putRecord({
        id, kind: "prompt", taskId, status: "queued", title: prompt,
        createdAt: Date.now(), updatedAt: Date.now(),
      });
      return NextResponse.json({ record: rec });
    }

    if (body.kind === "photo") {
      const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(body.image ?? "");
      if (!m) return NextResponse.json({ error: "Send a JPG, PNG or WebP image" }, { status: 400 });
      const buf = Buffer.from(m[2], "base64");
      if (buf.byteLength > 4_000_000) return NextResponse.json({ error: "Image is too large" }, { status: 413 });
      // Same photo → same id, so re-uploading it never spends credits twice.
      const id = `photo/${createHash("sha1").update(buf).digest("hex").slice(0, 16)}`;
      const existing = await getRecord(id);
      if (existing && existing.status !== "failed") return NextResponse.json({ record: existing });
      await spendBuild(req);
      const ext = m[1].split("/")[1].replace("jpeg", "jpg");
      const url = await uploadBuffer(buf, `photo.${ext}`);
      const taskId = await createImageTo3D([url], "turbo");
      const rec = await putRecord({
        id, kind: "photo", taskId, status: "queued", title: (body.title ?? "").trim().slice(0, 80) || "Your product",
        image: url, createdAt: Date.now(), updatedAt: Date.now(),
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
    await spendBuild(req);
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
    if (e instanceof QuotaError) return NextResponse.json({ error: e.message, quota: true }, { status: 429 });
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
