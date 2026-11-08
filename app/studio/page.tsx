"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ProductViewer from "@/components/ProductViewer";
import VariantPanel from "@/components/VariantPanel";
import { StatusBadge } from "@/components/ProductCard";
import { api, generateProduct, money, useModels, type ModelRecord, type Product } from "@/lib/client";

type StoreResp = { store: { domain: string; name: string; products: Product[] }; models: ModelRecord[] };
type Tab = "3d" | "ad" | "variants" | "embed" | "shopify";

const DEMO_STORES = ["allbirds.com", "www.fellowproducts.com", "www.ember.com", "www.misen.com"];

export default function StudioPage() {
  return <Suspense><Studio /></Suspense>;
}

function Studio() {
  const router = useRouter();
  const params = useSearchParams();
  const domain = params.get("store");
  const [input, setInput] = useState("");
  const [data, setData] = useState<StoreResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Tab>("3d");
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [allModels, setAllModels] = useState<ModelRecord[]>([]);
  const { models, upsert } = useModels([...(data?.models ?? []), ...allModels]);

  useEffect(() => {
    setData(null); setErr(null); setSel(null);
    if (!domain) return;
    api<StoreResp>(`/api/store?domain=${encodeURIComponent(domain)}`).then(setData).catch((e) => setErr(e.message));
  }, [domain]);

  // Variants live under their own ids; load them so the panel can show them.
  useEffect(() => {
    api<{ models: ModelRecord[] }>("/api/models?kind=variant").then((r) => setAllModels(r.models)).catch(() => {});
  }, [domain]);

  const products = data?.store.products ?? [];
  const shown = useMemo(() => products.filter((p) => !filter || p.title.toLowerCase().includes(filter.toLowerCase())), [products, filter]);
  const selected = products.find((p) => p.id === sel) ?? null;
  const rec = selected ? models[selected.id] : undefined;
  const inThreeD = products.filter((p) => models[p.id]?.status === "succeeded").length;

  async function buildChecked() {
    setBusy(true);
    for (const id of checked) {
      const p = products.find((x) => x.id === id);
      if (!p || models[id]?.status === "succeeded") continue;
      try { const { record } = await generateProduct(p); upsert(record); } catch (e) { setErr((e as Error).message); }
    }
    setChecked(new Set());
    setBusy(false);
  }

  if (!domain) {
    return (
      <main className="wrap" style={{ paddingTop: 48, maxWidth: 880 }}>
        <div className="eyebrow">Seller studio</div>
        <h1 className="display" style={{ fontSize: "clamp(36px, 6vw, 56px)", margin: "8px 0", lineHeight: 1 }}>Bring your store into 3D</h1>
        <p className="muted" style={{ fontSize: 17 }}>Enter your Shopify store address. We read your public catalogue, and Lux3D turns the products you pick into 3D models with AR, ads and colour variants.</p>
        <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) router.push(`/studio?store=${encodeURIComponent(input.trim().replace(/^https?:\/\//, "").split("/")[0])}`); }} style={{ display: "flex", gap: 8, marginTop: 24 }}>
          <input className="input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="yourstore.myshopify.com or yourstore.com" />
          <button className="btn btn-primary btn-lg">Open studio</button>
        </form>
        <div className="muted" style={{ fontSize: 14, marginTop: 16 }}>
          No store yet? Try one: {DEMO_STORES.map((d) => (
            <Link key={d} href={`/studio?store=${d}`} className="pill" style={{ marginRight: 6 }}>{d.replace(/^www\./, "")}</Link>
          ))}
        </div>
        <IdeaToProduct onRecord={upsert} models={models} />
      </main>
    );
  }

  return (
    <main className="wrap" style={{ paddingTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <Link href="/studio" className="faint" style={{ fontSize: 13 }}>← Change store</Link>
          <h1 className="display" style={{ fontSize: 40, margin: "4px 0 0", lineHeight: 1 }}>{data?.store.name ?? domain} <span className="faint" style={{ fontSize: 18 }}>studio</span></h1>
          <div className="muted" style={{ fontSize: 14 }}>{products.length} products · <b style={{ color: "var(--good)" }}>{inThreeD} in 3D</b></div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/store/${encodeURIComponent(domain)}`} className="btn">Open public 3D store ↗</Link>
        </div>
      </div>
      {err && <p style={{ color: "var(--accent)" }}>{err}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 380px) minmax(0, 1fr)", gap: 20, marginTop: 20, alignItems: "start" }} data-studio>
        {/* Product list */}
        <div className="card" style={{ padding: 12, position: "sticky", top: 80, maxHeight: "calc(100vh - 100px)", display: "flex", flexDirection: "column" }}>
          <input className="input" style={{ padding: "8px 14px", fontSize: 14 }} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter products" />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "10px 4px" }}>
            <span className="faint" style={{ fontSize: 13 }}>{checked.size ? `${checked.size} selected` : "Tick products to build in bulk"}</span>
            <button className="btn btn-accent btn-sm" disabled={!checked.size || busy} onClick={buildChecked}>{busy ? <span className="spin" /> : "Build in 3D"}</button>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {!data && <p className="muted" style={{ padding: 8 }}>Loading catalogue…</p>}
            {shown.map((p) => (
              <div key={p.id} onClick={() => { setSel(p.id); setTab("3d"); }}
                style={{ display: "flex", gap: 10, alignItems: "center", padding: 8, borderRadius: 12, cursor: "pointer", background: sel === p.id ? "var(--bg-2)" : undefined }}>
                <input type="checkbox" checked={checked.has(p.id)} onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setChecked((s) => { const n = new Set(s); if (e.target.checked) n.add(p.id); else n.delete(p.id); return n; })} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${p.images[0]}${p.images[0].includes("?") ? "&" : "?"}width=120`} alt="" style={{ width: 44, height: 44, objectFit: "contain", background: "#fff", borderRadius: 8 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
                    <span className="faint" style={{ fontSize: 12 }}>{money(p.price)}</span>
                    <StatusBadge rec={models[p.id]} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tools */}
        <div>
          {!selected ? (
            <div className="card" style={{ padding: 32, textAlign: "center" }}>
              <div className="display" style={{ fontSize: 26 }}>Pick a product</div>
              <p className="muted">Choose a product on the left to build it in 3D, make an ad, add colourways or push it to Shopify.</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22 }}>{selected.title}</h2>
                  <div className="muted" style={{ fontSize: 14 }}>{money(selected.price)} · {selected.type || selected.vendor}</div>
                </div>
                <StatusBadge rec={rec} />
              </div>
              <div style={{ display: "flex", gap: 6, margin: "16px 0", flexWrap: "wrap" }}>
                {([["3d", "3D & AR"], ["ad", "3D ad"], ["variants", "Colourways"], ["embed", "Embed"], ["shopify", "Push to Shopify"]] as [Tab, string][]).map(([t, label]) => (
                  <button key={t} className={`btn btn-sm ${tab === t ? "btn-primary" : ""}`} disabled={t !== "3d" && !rec?.glb} onClick={() => setTab(t)}>{label}</button>
                ))}
              </div>

              {tab === "3d" && <BuildPanel p={selected} rec={rec} onRecord={upsert} />}
              {tab === "ad" && rec?.glb && (
                <div className="muted">
                  <p>Turn this model into a cinematic product ad with camera moves, your price and a call to action — exported as video for TikTok, Reels or YouTube.</p>
                  <Link className="btn btn-accent" href={`/studio/ad?id=${encodeURIComponent(rec.id)}`}>Open in Ad studio →</Link>
                </div>
              )}
              {tab === "variants" && rec?.glb && (
                <VariantPanel parent={rec} variants={Object.values(models).filter((m) => m.parentId === rec.id)} onRecord={upsert} />
              )}
              {tab === "embed" && rec?.glb && <EmbedPanel rec={rec} />}
              {tab === "shopify" && rec?.glb && <ShopifyPanel p={selected} rec={rec} />}
            </div>
          )}
        </div>
      </div>
      <style>{`@media (max-width: 860px){ [data-studio]{ grid-template-columns: 1fr !important } [data-studio] > .card { position: static !important; max-height: 360px !important } }`}</style>
    </main>
  );
}

function BuildPanel({ p, rec, onRecord }: { p: Product; rec?: ModelRecord; onRecord: (r: ModelRecord) => void }) {
  const [angles, setAngles] = useState(1);
  const [quality, setQuality] = useState<"turbo" | "standard">("turbo");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const building = rec && (rec.status === "queued" || rec.status === "running");

  async function go(force = false) {
    setBusy(true); setErr(null);
    try { const { record } = await generateProduct(p, { angles, quality, force }); onRecord(record); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} data-split>
      <div>
        <div className="faint" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>PRODUCT PHOTO</div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.images[0]} alt="" style={{ width: "100%", aspectRatio: "1/1", objectFit: "contain", background: "#fff", borderRadius: 14, border: "1px solid var(--line)" }} />
      </div>
      <div>
        <div className="faint" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>LUX3D MODEL</div>
        <div style={{ aspectRatio: "1/1", borderRadius: 14, border: "1px solid var(--line)", background: "radial-gradient(ellipse at 50% 60%, var(--card), var(--bg-2))", position: "relative", overflow: "hidden" }}>
          {rec?.glb ? <ProductViewer src={rec.glb} usdz={rec.usdz} alt={p.title} /> : (
            <div style={{ height: "100%", display: "grid", placeItems: "center", padding: 16, textAlign: "center" }}>
              {building ? <div><span className="spin" style={{ color: "var(--accent)" }} /><div style={{ fontWeight: 600, marginTop: 8 }}>Sculpting… about 2 min</div></div> : (
                <div>
                  <div className="muted" style={{ fontSize: 14, marginBottom: 12 }}>Not built yet</div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 12 }}>
                    <select value={quality} onChange={(e) => setQuality(e.target.value as "turbo" | "standard")} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "4px 8px", background: "var(--card)" }}>
                      <option value="turbo">Turbo (fast)</option>
                      <option value="standard">Standard (best)</option>
                    </select>
                    {p.images.length > 1 && (
                      <select value={angles} onChange={(e) => setAngles(Number(e.target.value))} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "4px 8px", background: "var(--card)" }}>
                        {Array.from({ length: Math.min(4, p.images.length) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} photo{n > 1 ? "s" : ""}</option>)}
                      </select>
                    )}
                  </div>
                  <button className="btn btn-accent" disabled={busy} onClick={() => go(rec?.status === "failed")}>{busy ? <span className="spin" /> : rec?.status === "failed" ? "Try again" : "Build in 3D"}</button>
                </div>
              )}
            </div>
          )}
        </div>
        {rec?.glb && (
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <a className="btn btn-sm" href={rec.glb} download>Download GLB</a>
            <button className="btn btn-sm" onClick={() => go(true)} disabled={busy}>Rebuild</button>
          </div>
        )}
        {(err || rec?.error) && <div style={{ color: "var(--accent)", fontSize: 13, marginTop: 8 }}>{err ?? rec?.error}</div>}
      </div>
      <style>{`@media (max-width: 560px){ [data-split]{ grid-template-columns: 1fr !important } }`}</style>
    </div>
  );
}

function EmbedPanel({ rec }: { rec: ModelRecord }) {
  const code = `<script type="module" src="https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js"></script>
<model-viewer src="${rec.glb}" alt="${rec.title.replace(/"/g, "&quot;")}"
  camera-controls auto-rotate ar ar-modes="webxr scene-viewer quick-look"
  shadow-intensity="1" style="width:100%;height:480px"></model-viewer>`;
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>Paste this on any website — WordPress, Wix, Squarespace, WooCommerce, a blog — to show the spinning 3D product with an AR button.</p>
      <pre style={{ background: "var(--ink)", color: "var(--bg)", padding: 16, borderRadius: 12, fontSize: 12, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{code}</pre>
      <button className="btn btn-sm" onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied ✓" : "Copy code"}</button>
    </div>
  );
}

function ShopifyPanel({ p, rec }: { p: Product; rec: ModelRecord }) {
  const [shop, setShop] = useState(p.domain.endsWith("myshopify.com") ? p.domain : "");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; link?: string } | null>(null);

  useEffect(() => {
    try { const s = sessionStorage.getItem("shopify-shop"); if (s) setShop(s); } catch { /* ignore */ }
  }, []);

  async function push() {
    setBusy(true); setMsg(null);
    try { sessionStorage.setItem("shopify-shop", shop); } catch { /* ignore */ }
    try {
      const r = await api<{ product: string; admin: string }>("/api/shopify/push", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop, token, handle: p.handle, glb: rec.glb, title: p.title }),
      });
      setMsg({ ok: true, text: `Added the 3D model to “${r.product}”. Shopify now shows 3D + AR on the product page.`, link: r.admin });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        Send this model to the matching product (handle <code>{p.handle}</code>) in your Shopify store. Shopify’s own product page then shows a 3D viewer and a “View in your space” AR button.
      </p>
      <div style={{ display: "grid", gap: 8, maxWidth: 480 }}>
        <input className="input" style={{ padding: "10px 16px", fontSize: 14 }} value={shop} onChange={(e) => setShop(e.target.value)} placeholder="yourstore.myshopify.com" />
        <input className="input" style={{ padding: "10px 16px", fontSize: 14 }} type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Admin API access token (shpat_…)" />
        <button className="btn btn-accent" disabled={busy || !shop || !token} onClick={push}>{busy ? <><span className="spin" /> Uploading to Shopify</> : "Push 3D model to Shopify"}</button>
      </div>
      <details style={{ marginTop: 12 }} className="muted">
        <summary style={{ cursor: "pointer", fontSize: 13 }}>Where do I get a token?</summary>
        <ol style={{ fontSize: 13 }}>
          <li>In Shopify admin: Settings → Apps and sales channels → Develop apps → Create an app.</li>
          <li>Configure Admin API scopes: <code>read_products</code>, <code>write_products</code>.</li>
          <li>Install the app and copy the Admin API access token. It’s used for this upload only and never stored.</li>
        </ol>
      </details>
      {msg && (
        <div style={{ marginTop: 12, color: msg.ok ? "var(--good)" : "var(--accent)", fontSize: 14 }}>
          {msg.text} {msg.link && <a href={msg.link} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>Open in Shopify admin ↗</a>}
        </div>
      )}
    </div>
  );
}

function IdeaToProduct({ onRecord, models }: { onRecord: (r: ModelRecord) => void; models: Record<string, ModelRecord> }) {
  const [prompt, setPrompt] = useState("");
  const [id, setId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const rec = id ? models[id] : undefined;

  async function go() {
    setBusy(true); setErr(null);
    try {
      const { record } = await api<{ record: ModelRecord }>("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "prompt", prompt }),
      });
      onRecord(record); setId(record.id);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <section className="card" style={{ padding: 24, marginTop: 40 }}>
      <div className="eyebrow">Idea → product</div>
      <h2 className="display" style={{ fontSize: 28, margin: "6px 0" }}>Don’t have the product yet?</h2>
      <p className="muted" style={{ marginTop: 0 }}>Describe it. Lux3D builds a 3D prototype you can show customers, test in AR and make an ad for — before you manufacture anything.</p>
      <form onSubmit={(e) => { e.preventDefault(); if (prompt.trim()) go(); }} style={{ display: "flex", gap: 8 }}>
        <input className="input" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="A matte terracotta desk lamp with a brass switch" />
        <button className="btn btn-primary" disabled={busy}>{busy ? <span className="spin" /> : "Create"}</button>
      </form>
      {err && <div style={{ color: "var(--accent)", fontSize: 13, marginTop: 8 }}>{err}</div>}
      {rec && (
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "minmax(0, 360px) 1fr", gap: 16, alignItems: "center" }}>
          <div style={{ aspectRatio: "1/1", borderRadius: 14, background: "radial-gradient(ellipse at 50% 60%, var(--card), var(--bg-2))", position: "relative", overflow: "hidden" }}>
            {rec.glb ? <ProductViewer src={rec.glb} alt={rec.title} /> : (
              <div style={{ height: "100%", display: "grid", placeItems: "center" }}><span className="muted"><span className="spin" /> Lux3D is building your idea…</span></div>
            )}
          </div>
          {rec.glb && <Link className="btn btn-accent" href={`/studio/ad?id=${encodeURIComponent(rec.id)}`}>Make an ad for it →</Link>}
        </div>
      )}
    </section>
  );
}
