// Record of every 3D model generated, keyed by product id. Generation costs
// credits, so a product is never generated twice.
//
// Two layers:
//  - data/catalog.json — committed, pre-generated models that always work in the demo
//  - data/cache.json   — runtime cache written by this server (gitignored)
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

const DATA_DIR = path.join(process.cwd(), "data");
const CACHE = path.join(DATA_DIR, "cache.json");
const CATALOG = path.join(DATA_DIR, "catalog.json");

let mem: Record<string, ModelRecord> | null = null;

async function readJson(file: string): Promise<Record<string, ModelRecord>> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return {};
  }
}

async function load(): Promise<Record<string, ModelRecord>> {
  if (mem) return mem;
  const [catalog, cache] = await Promise.all([readJson(CATALOG), readJson(CACHE)]);
  mem = { ...catalog, ...cache };
  return mem;
}

async function persist() {
  if (!mem) return;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(CACHE, JSON.stringify(mem, null, 2));
  } catch {
    // Read-only filesystems (serverless) keep the in-memory copy only.
  }
}

export async function getRecord(id: string): Promise<ModelRecord | undefined> {
  return (await load())[id];
}

export async function putRecord(rec: ModelRecord): Promise<ModelRecord> {
  const all = await load();
  all[rec.id] = rec;
  await persist();
  return rec;
}

export async function listRecords(filter?: (r: ModelRecord) => boolean): Promise<ModelRecord[]> {
  const all = Object.values(await load());
  return (filter ? all.filter(filter) : all).sort((a, b) => b.updatedAt - a.updatedAt);
}

// Refresh a pending record from Lux3D. Safe to call often.
export async function refresh(id: string): Promise<ModelRecord | undefined> {
  const rec = await getRecord(id);
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
    await putRecord(rec);
  } catch (e) {
    rec.error = (e as Error).message;
  }
  return rec;
}
