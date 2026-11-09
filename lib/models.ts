// Record of every 3D model generated, keyed by product id. Generation costs
// credits, so a product is never generated twice.
//
// Two layers:
//  - data/catalog.json — committed, pre-generated models that always work in the demo
//  - runtime records — Upstash Redis in production, data/cache.json locally
import { promises as fs } from "node:fs";
import path from "node:path";
import { getTask, type TaskStatus } from "./lux3d";

export type ModelRecord = {
  id: string; // product id (`domain/handle`) or `prompt/<slug>` / `variant/...`
  kind: "product" | "prompt" | "variant";
  taskId: number;
  status: TaskStatus;
  glb?: string;
  usdz?: string;
  title: string;
  image?: string;
  domain?: string;
  price?: string;
  url?: string;
  parentId?: string; // for variants
  label?: string; // variant label, e.g. "Walnut"
  createdAt: number;
  updatedAt: number;
  error?: string;
};

// Committed demo models are bundled into the build (works on serverless hosts).
import catalogJson from "@/data/catalog.json";
const CATALOG = catalogJson as unknown as Record<string, ModelRecord>;

// ---------- storage backends ----------
// Production (Vercel): Upstash Redis via its REST API — add the Upstash integration
// in the Vercel dashboard and it sets these env vars. Local dev: a JSON file.
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const HASH = "showroom:models";

async function redis<T>(cmd: (string | number)[]): Promise<T> {
  const res = await fetch(REDIS_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  const body = (await res.json()) as { result?: T; error?: string };
  if (body.error) throw new Error(`Redis: ${body.error}`);
  return body.result as T;
}

const CACHE_FILE = path.join(process.cwd(), "data", "cache.json");
let fileMem: Record<string, ModelRecord> | null = null;

async function fileLoad(): Promise<Record<string, ModelRecord>> {
  if (fileMem) return fileMem;
  try {
    fileMem = JSON.parse(await fs.readFile(CACHE_FILE, "utf8"));
  } catch {
    fileMem = {};
  }
  return fileMem!;
}

async function loadAll(): Promise<Record<string, ModelRecord>> {
  if (REDIS_URL && REDIS_TOKEN) {
    const flat = (await redis<string[]>(["HGETALL", HASH])) ?? [];
    const out: Record<string, ModelRecord> = {};
    for (let i = 0; i < flat.length; i += 2) out[flat[i]] = JSON.parse(flat[i + 1]);
    return { ...CATALOG, ...out };
  }
  return { ...CATALOG, ...(await fileLoad()) };
}

export async function getRecord(id: string): Promise<ModelRecord | undefined> {
  if (REDIS_URL && REDIS_TOKEN) {
    const v = await redis<string | null>(["HGET", HASH, id]);
    return v ? JSON.parse(v) : CATALOG[id];
  }
  return (await fileLoad())[id] ?? CATALOG[id];
}

export async function putRecord(rec: ModelRecord): Promise<ModelRecord> {
  if (REDIS_URL && REDIS_TOKEN) {
    await redis(["HSET", HASH, rec.id, JSON.stringify(rec)]);
    return rec;
  }
  const all = await fileLoad();
  all[rec.id] = rec;
  try {
    await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(all, null, 2));
  } catch {
    // Read-only filesystem: keep the in-memory copy.
  }
  return rec;
}

export async function listRecords(filter?: (r: ModelRecord) => boolean): Promise<ModelRecord[]> {
  const all = Object.values(await loadAll());
  return (filter ? all.filter(filter) : all).sort((a, b) => b.updatedAt - a.updatedAt);
}

// Refresh a pending record from Lux3D. Safe to call often.
// `known` is the client's copy, used when this server instance has no record of
// the task (serverless instances without a shared database).
export async function refresh(id: string, known?: ModelRecord): Promise<ModelRecord | undefined> {
  const stored = await getRecord(id);
  // A client-supplied record is only refreshed, never saved, so nobody can inject
  // entries into the shared mall.
  const rec = stored ?? (known && known.id === id && Number.isFinite(known.taskId) ? { ...known } : undefined);
  if (!rec || rec.status === "succeeded" || rec.status === "failed") return rec;
  try {
    const t = await getTask(rec.taskId);
    rec.status = t.status;
    rec.updatedAt = Date.now();
    if (t.status === "succeeded") {
      rec.glb = t.outputs.find((u) => u.toLowerCase().includes(".glb")) ?? t.outputs[0];
      rec.usdz = t.outputs.find((u) => u.toLowerCase().includes(".usdz"));
    }
    if (t.status === "failed") rec.error = "Lux3D could not build this model. Try a clearer photo.";
    if (stored) await putRecord(rec);
  } catch (e) {
    rec.error = (e as Error).message;
  }
  return rec;
}
