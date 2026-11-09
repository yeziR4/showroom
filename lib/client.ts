"use client";
// Client helpers shared by pages.
import { useEffect, useRef, useState } from "react";
import type { ModelRecord } from "./models";
import type { Product } from "./shopify";

export type { ModelRecord, Product };

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export function generateProduct(p: Product, opts: { quality?: "turbo" | "standard"; angles?: number; force?: boolean } = {}) {
  return api<{ record: ModelRecord }>("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: "product", id: p.id, title: p.title, images: p.images, domain: p.domain,
      price: p.price, url: p.url, ...opts,
    }),
  });
}

// Keeps a map of model records fresh by polling any that are still building.
export function useModels(initial: ModelRecord[] = []) {
  const [models, setModels] = useState<Record<string, ModelRecord>>({});
  const ref = useRef(models);
  ref.current = models;

  useEffect(() => {
    if (!initial.length) return;
    setModels((m) => ({ ...Object.fromEntries(initial.map((r) => [r.id, r])), ...m }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initial.map((r) => r.id + r.status))]);

  useEffect(() => {
    const t = setInterval(async () => {
      const pending = Object.values(ref.current).filter((r) => r.status === "queued" || r.status === "running");
      for (const r of pending) {
        try {
          const { record } = await api<{ record: ModelRecord }>("/api/task", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ record: r }),
          });
          setModels((m) => ({ ...m, [record.id]: record }));
        } catch {
          /* keep polling */
        }
      }
    }, 6000);
    return () => clearInterval(t);
  }, []);

  const upsert = (r: ModelRecord) => setModels((m) => ({ ...m, [r.id]: r }));
  return { models, upsert };
}

export function money(price: string) {
  const n = Number(price);
  return Number.isFinite(n) && price ? `$${n.toFixed(n % 1 ? 2 : 0)}` : "";
}
