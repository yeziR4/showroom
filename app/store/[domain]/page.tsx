"use client";
import { use, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import ProductDrawer from "@/components/ProductDrawer";
import { api, generateProduct, useModels, type ModelRecord, type Product } from "@/lib/client";

const Showroom3D = dynamic(() => import("@/components/Showroom3D"), { ssr: false });

type StoreResp = { store: { domain: string; name: string; products: Product[] }; models: ModelRecord[] };

export default function StorePage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain: raw } = use(params);
  const domain = decodeURIComponent(raw);
  const [data, setData] = useState<StoreResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<Product | null>(null);
  const [filter, setFilter] = useState("");
  const [batching, setBatching] = useState(false);
  const { models, upsert } = useModels(data?.models ?? []);

  useEffect(() => {
    api<StoreResp>(`/api/store?domain=${encodeURIComponent(domain)}`).then(setData).catch((e) => setErr(e.message));
  }, [domain]);

  const products = data?.store.products ?? [];
  const shown = useMemo(() => products.filter((p) => !filter || `${p.title} ${p.type}`.toLowerCase().includes(filter.toLowerCase())), [products, filter]);
  const ready = products.filter((p) => models[p.id]?.status === "succeeded" && models[p.id]?.glb);
  const building = products.filter((p) => ["queued", "running"].includes(models[p.id]?.status ?? ""));

  async function buildTop(n: number) {
    setBatching(true);
    const todo = shown.filter((p) => !models[p.id] || models[p.id].status === "failed").slice(0, n);
    for (const p of todo) {
      try { const { record } = await generateProduct(p); upsert(record); } catch { /* concurrency limit — skip */ }
    }
    setBatching(false);
  }

  if (err) return (
    <main className="wrap" style={{ paddingTop: 48 }}>
      <h1 className="display">Can’t open {domain}</h1>
      <p className="muted">{err}. The store may not be on Shopify, or its storefront is password-protected.</p>
      <Link href="/explore" className="btn">← Back to the mall</Link>
    </main>
  );

  return (
    <main>
      <section className="wrap" style={{ paddingTop: 32, display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <Link href="/explore" className="faint" style={{ fontSize: 13 }}>← The 3D mall</Link>
          <h1 className="display" style={{ fontSize: "clamp(36px, 6vw, 56px)", margin: "6px 0 4px", lineHeight: 1 }}>{data?.store.name ?? "Opening store…"}</h1>
          <div className="muted" style={{ fontSize: 14 }}>
            {domain.replace(/^www\./, "")} · {products.length} products · <b style={{ color: "var(--good)" }}>{ready.length} in 3D</b>
            {building.length > 0 && <> · <span style={{ color: "var(--accent)" }}>{building.length} building</span></>}
          </div>
        </div>
        <a className="btn" href={`https://${domain}`} target="_blank" rel="noreferrer">Visit store ↗</a>
      </section>

      <section className="wrap" style={{ marginTop: 20 }}>
        <div className="card" style={{ height: "min(62vh, 560px)", overflow: "hidden", position: "relative", padding: 0 }}>
          {ready.length > 0 ? (
            <Showroom3D
              items={ready.slice(0, 15).map((p) => ({ id: p.id, glb: models[p.id].glb!, title: p.title, price: p.price }))}
              onSelect={(id) => setOpen(products.find((p) => p.id === id) ?? null)}
              activeId={open?.id}
            />
          ) : (
            <div style={{ height: "100%", display: "grid", placeItems: "center", textAlign: "center", padding: 24, background: "radial-gradient(ellipse at 50% 70%, var(--card), var(--bg-2))" }}>
              <div>
                <div className="display" style={{ fontSize: 28 }}>The showroom floor is empty</div>
                <p className="muted" style={{ maxWidth: 420 }}>Pick a product below and press “Build in 3D”, or build the first few in one go. Lux3D takes about two minutes per product.</p>
                <button className="btn btn-accent" disabled={batching || !products.length} onClick={() => buildTop(3)}>
                  {batching ? <><span className="spin" /> Sending</> : "Build the first 3 in 3D"}
                </button>
              </div>
            </div>
          )}
          {ready.length > 0 && (
            <div style={{ position: "absolute", left: 14, top: 14 }} className="pill">Drag to look around · click a product</div>
          )}
        </div>
      </section>

      <section className="wrap" style={{ marginTop: 28 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
          <input className="input" style={{ maxWidth: 360, padding: "10px 16px", fontSize: 14 }} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`Search ${data?.store.name ?? "this store"}…`} />
          <span className="faint" style={{ fontSize: 13 }}>{shown.length} products</span>
        </div>
        <div className="grid">
          {shown.slice(0, 120).map((p) => <ProductCard key={p.id} p={p} rec={models[p.id]} onOpen={() => setOpen(p)} />)}
        </div>
        {!data && <p className="muted">Loading products…</p>}
      </section>

      {open && <ProductDrawer p={open} rec={models[open.id]} onClose={() => setOpen(null)} onRecord={upsert} />}
    </main>
  );
}
