// Record of every 3D model generated, keyed by product id. Generation costs
// credits, so a product is never generated twice.
//
// Two layers:
//  - data/catalog.json — committed, pre-generated models that always work in the demo
//  - runtime records — Upstash Redis in production, data/cache.json locally
import { promises as fs } from "node:fs";
import path from "node:path";
import { getTask, type TaskStatus } from "./lux3d";
import { hasRedis, redis } from "./redis";

export type ModelRecord = {
  id: string; // product id (`domain/handle`) or `prompt/<slug>` / `variant/...`
  kind: "product" | "prompt" | "variant" | "photo";
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
  example?: boolean; // pre-generated demo model from data/catalog.json
  public?: boolean; // visitor uploads: shown in the showcase only if the visitor opted in
  hidden?: boolean; // removed from the showcase by the site owner
};

// What the public showcase may show.
export function isShowcased(r: ModelRecord): boolean {
  if (r.status !== "succeeded" || !r.glb || r.hidden) return false;
  if (r.kind === "variant") return false;
  if (r.kind === "photo") return r.public === true; // visitors opt in explicitly
  return true;
}

// Committed demo models are bundled into the build (works on serverless hosts).
import catalogJson from "@/data/catalog.json";
const CATALOG: Record<string, ModelRecord> = Object.fromEntries(
  Object.entries(catalogJson as unknown as Record<string, ModelRecord>).map(([k, v]) => [k, { ...v, example: true }]),
);

// ---------- storage backends ----------
// Production (Vercel): Upstash Redis. Local dev: a JSON file.
const HASH = "showroom:models";

// DATA_DIR lets a host point this at persistent storage (ModelScope: /mnt/workspace).
const CACHE_FILE = path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "cache.json");
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

import overridesJson from "@/data/showcase-overrides.json";

// Committed curation (data/showcase-overrides.json): hide entries or replace an
// upload filename with a readable product name — works without database access.
const OVERRIDES = overridesJson as unknown as Record<string, { hidden?: boolean; title?: string; public?: boolean }>;

function applyOverride(r: ModelRecord): ModelRecord {
  const o = OVERRIDES[r.id];
  if (!o || typeof o !== "object") return r;
  return { ...r, ...(o.title ? { title: o.title } : {}), ...(o.hidden ? { hidden: true } : {}), ...(o.public ? { public: true } : {}) };
}

// Stored copies of catalog models (e.g. after being hidden) stay labelled as examples.
function withExampleFlags(all: Record<string, ModelRecord>) {
  for (const id of Object.keys(CATALOG)) if (all[id]) all[id] = { ...all[id], example: true };
  for (const id of Object.keys(all)) all[id] = applyOverride(all[id]);
  return all;
}

async function loadAll(): Promise<Record<string, ModelRecord>> {
  if (hasRedis) {
    const flat = (await redis<string[]>(["HGETALL", HASH])) ?? [];
    const out: Record<string, ModelRecord> = {};
    for (let i = 0; i < flat.length; i += 2) out[flat[i]] = JSON.parse(flat[i + 1]);
    return withExampleFlags({ ...CATALOG, ...out });
  }
  return withExampleFlags({ ...CATALOG, ...(await fileLoad()) });
}

export async function getRecord(id: string): Promise<ModelRecord | undefined> {
  if (hasRedis) {
    const v = await redis<string | null>(["HGET", HASH, id]);
    const r = v ? JSON.parse(v) : CATALOG[id];
    return r ? applyOverride(r) : r;
  }
  const r = (await fileLoad())[id] ?? CATALOG[id];
  return r ? applyOverride(r) : r;
}

export async function putRecord(rec: ModelRecord): Promise<ModelRecord> {
  if (hasRedis) {
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
