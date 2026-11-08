// Server-side client for the Aholo / Lux3D Global API.
// Docs: https://labs.aholo.ai/api-docs/en  (OpenAPI: /api-docs/en/openapi.en.json)
import { createHash } from "node:crypto";

const GATEWAY = "https://api.aholo.ai/global";

type Envelope<T> = { c: string; m: string; d: T; f: unknown };

function apiKey(): string {
  const key = process.env.AHOLO_API_KEY;
  if (!key) throw new Error("AHOLO_API_KEY is not set");
  return key;
}

async function gateway<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: {
      // Aholo expects the raw key, no "Bearer" prefix.
      Authorization: apiKey(),
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let body: Envelope<T> | T;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Aholo ${path} returned HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  // Most endpoints wrap results as {c, m, d}; a few (e.g. the upload token) return the object directly.
  if (body && typeof body === "object" && "c" in body) {
    if (body.c !== "0") throw new Error(`Aholo ${path} failed: ${body.c} ${body.m}`);
    return body.d;
  }
  if (!res.ok) throw new Error(`Aholo ${path} returned HTTP ${res.status}: ${text.slice(0, 200)}`);
  return body as T;
}

// ---------- Asset upload (OUS) ----------
// Lux3D cannot fetch images from arbitrary CDNs (Shopify's CDN fails), so every
// input image is first copied into Aholo's own object storage.

type OusToken = { ousToken: string; globalDomain: string; blockSize: number };

export async function uploadBuffer(buf: Buffer, filename: string): Promise<string> {
  const token = await gateway<OusToken>("/asset/v1/token");
  const md5 = createHash("md5").update(buf).digest("hex");
  const form = new FormData();
  form.append("md5", md5);
  form.append("file", new Blob([new Uint8Array(buf)]), filename);

  const up = await fetch(`${token.globalDomain}/ous/api/v2/single/upload`, {
    method: "POST",
    headers: { "ous-token-v2": token.ousToken },
    body: form,
  });
  const upBody = (await up.json()) as Envelope<unknown>;
  if (upBody.c !== "0") throw new Error(`Upload failed: ${upBody.m}`);

  // The status endpoint is bound to the token; poll briefly until terminal.
  for (let i = 0; i < 40; i++) {
    const st = await fetch(`${token.globalDomain}/ous/api/v2/upload/status`, {
      headers: { "ous-token-v2": token.ousToken },
    });
    const body = (await st.json()) as Envelope<{ status: number; url?: string }>;
    if (body.d?.status === 5 && body.d.url) return body.d.url;
    if (body.d && [6, 8].includes(body.d.status)) throw new Error("Upload rejected by storage");
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Upload timed out");
}

export async function uploadFromUrl(src: string): Promise<string> {
  // Ask Shopify's CDN for a sensible size; ignored by other hosts.
  const url = new URL(src);
  if (url.hostname.endsWith("shopify.com") || url.pathname.includes("/cdn/shop/")) {
    url.searchParams.set("width", "1024");
  }
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not download image (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = (res.headers.get("content-type") ?? "image/jpeg").split("/")[1]?.split(";")[0] ?? "jpg";
  return uploadBuffer(buf, `product.${ext === "jpeg" ? "jpg" : ext}`);
}

// ---------- Lux3D tasks ----------

export type Quality = "turbo" | "standard";

export type TaskStatus = "queued" | "running" | "succeeded" | "failed";

export type TaskResult = {
  taskId: number;
  status: TaskStatus;
  outputs: string[];
};

// Lux3D numeric status → our label. 3 = success, 4 = failed (observed).
function mapStatus(n: number): TaskStatus {
  if (n === 3) return "succeeded";
  if (n === 4 || n === 5) return "failed";
  if (n === 0) return "queued";
  return "running";
}

export async function createImageTo3D(images: string[], quality: Quality = "turbo"): Promise<number> {
  if (images.length === 0) throw new Error("No images");
  const body: Record<string, unknown> =
    quality === "turbo"
      ? { version: "G1-Turbo", outputFormat: ["glb"], enablePbr: true }
      : { version: "G1" };
  // Lighter meshes load faster in a web shop; 300k is the API default.
  body.faceCount = 80000;
  if (images.length === 1) body.img = images[0];
  else body.imgs = images.slice(0, 32);
  return gateway<number>("/lux3d/v1/generate/img-to-3d/task/create", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createTextTo3D(prompt: string, style = "photorealistic"): Promise<number> {
  return gateway<number>("/lux3d/v1/generate/text-to-3d/task/create", {
    method: "POST",
    body: JSON.stringify({ prompt, style, version: "G1-Turbo", outputFormat: ["glb"], enablePbr: true, faceCount: 80000 }),
  });
}

export async function createMaterialTransfer(glbUrl: string, materialImage: string): Promise<number> {
  return gateway<number>("/lux3d/v1/generate/material-transfer/task/create", {
    method: "POST",
    body: JSON.stringify({ meshUrl: glbUrl, img: materialImage, version: "v3.0-standard", outputFormat: ["glb", "usdz"] }),
  });
}

export async function getTask(taskId: number): Promise<TaskResult> {
  const d = await gateway<{ status: number; outputs?: { content: string }[] }>(
    `/lux3d/v1/generate/task/get?taskid=${encodeURIComponent(String(taskId))}`,
  );
  return {
    taskId,
    status: mapStatus(d.status),
    outputs: (d.outputs ?? []).map((o) => o.content).filter(Boolean),
  };
}
