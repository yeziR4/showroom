"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import ProductDrawer from "@/components/ProductDrawer";
import ProductViewer from "@/components/ProductViewer";
import { api, useModels, type ModelRecord, type Product } from "@/lib/client";

type StoreTile = { domain: string; name: string };

const SUGGESTIONS = ["sneakers", "mug", "wallet", "sheets", "watch", "kettle", "pan", "coffee"];

export default function Explore() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [stores, setStores] = useState<StoreTile[]>([]);
  const [results, setResults] = useState<Product[] | null>(null);
  const [fresh, setFresh] = useState<ModelRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<Product | null>(null);
  const { models, upsert } = useModels();

  useEffect(() => {
    api<{ stores: StoreTile[] }>("/api/search").then((r) => setStores(r.stores)).catch(() => {});
    api<{ models: ModelRecord[] }>("/api/models").then((r) => setFresh(r.models)).catch(() => {});
  }, []);

  function looksLikeStore(s: string) {
    const t = s.trim().toLowerCase();
    return /\.[a-z]{2,}(\/|$)/.test(t) || t.startsWith("http") || stores.some((st) => st.name.toLowerCase() === t);
  }

  async function search(term = q) {
    const t = term.trim();
    if (!t) return;
    setErr(null);
    if (looksLikeStore(t)) {
      const match = stores.find((st) => st.name.toLowerCase() === t.toLowerCase());
      router.push(`/store/${encodeURIComponent(match ? match.domain : t.replace(/^https?:\/\//, "").split("/")[0])}`);
      return;
    }
    setLoading(true);
    try {
      const r = await api<{ products: Product[]; models: ModelRecord[] }>(`/api/search?q=${encodeURIComponent(t)}`);
      setResults(r.products);
      r.models.forEach(upsert);
    } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }

  const byStore = results?.reduce<Record<string, number>>((acc, p) => ((acc[p.domain] = (acc[p.domain] ?? 0) + 1), acc), {});

  return (
    <main className="wrap" style={{ paddingTop: 40 }}>
      <div className="eyebrow">The 3D mall</div>
      <h1 className="display" style={{ fontSize: "clamp(36px, 6vw, 60px)", margin: "8px 0 8px", lineHeight: 1 }}>Find it. Spin it. Put it in your room.</h1>
      <p className="muted" style={{ fontSize: 17, maxWidth: 640 }}>
        Search for a product to see which stores sell it, or type a store’s address to walk through it in 3D.
      </p>

      <form onSubmit={(e) => { e.preventDefault(); search(); }} style={{ display: "flex", gap: 8, marginTop: 20, maxWidth: 720 }}>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try “sneakers”, “ceramic mug” or allbirds.com" />
        <button className="btn btn-primary btn-lg" disabled={loading}>{loading ? <span className="spin" /> : "Search"}</button>
      </form>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
        {SUGGESTIONS.map((s) => (
          <button key={s} className="btn btn-sm btn-ghost" onClick={() => { setQ(s); search(s); }}>{s}</button>
        ))}
      </div>
      {err && <p style={{ color: "var(--accent)" }}>{err}</p>}

      {results && (
        <section style={{ marginTop: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>{results.length} products from {Object.keys(byStore ?? {}).length} stores</h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Object.entries(byStore ?? {}).map(([d, n]) => (
                <Link key={d} href={`/store/${encodeURIComponent(d)}`} className="pill">{d.replace(/^www\./, "")} · {n}</Link>
              ))}
            </div>
          </div>
          {results.length === 0 && <p className="muted">Nothing found. Try another word.</p>}
          <div className="grid" style={{ marginTop: 16 }}>
            {results.map((p) => <ProductCard key={p.id} p={p} rec={models[p.id]} onOpen={() => setOpen(p)} showStore />)}
          </div>
        </section>
      )}

      {!results && (
        <>
          <section style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 20, margin: "0 0 12px" }}>Stores in the mall</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
              {stores.map((s, i) => (
                <Link key={s.domain} href={`/store/${encodeURIComponent(s.domain)}`} className="card"
                  style={{ padding: 18, display: "flex", flexDirection: "column", gap: 18, minHeight: 120, background: `linear-gradient(140deg, var(--card), hsl(${(i * 47) % 360} 60% 88% / .35))` }}>
                  <span className="display" style={{ fontSize: 22 }}>{s.name}</span>
                  <span className="faint" style={{ fontSize: 12, marginTop: "auto" }}>{s.domain.replace(/^www\./, "")} →</span>
                </Link>
              ))}
            </div>
          </section>

          {fresh.length > 0 && (
            <section style={{ marginTop: 40 }}>
              <h2 style={{ fontSize: 20, margin: "0 0 12px" }}>Already in 3D</h2>
              <div className="grid">
                {fresh.map((m) => (
                  <Link key={m.id} href={m.domain && m.domain !== "demo" ? `/store/${encodeURIComponent(m.domain)}` : "#"} className="card" style={{ overflow: "hidden" }}>
                    <div style={{ aspectRatio: "1/1", background: "var(--bg-2)" }}>
                      <ProductViewer src={m.glb!} alt={m.title} poster={m.image} ar={false} />
                    </div>
                    <div style={{ padding: 12 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{m.title}</div>
                      <div className="faint" style={{ fontSize: 12 }}>{m.domain}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {open && <ProductDrawer p={open} rec={models[open.id]} onClose={() => setOpen(null)} onRecord={upsert} />}
    </main>
  );
}
