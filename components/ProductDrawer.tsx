"use client";
import { useState } from "react";
import Link from "next/link";
import ProductViewer from "./ProductViewer";
import { StatusBadge } from "./ProductCard";
import { generateProduct, money, type ModelRecord, type Product } from "@/lib/client";

export default function ProductDrawer({
  p, rec, onClose, onRecord, seller = false,
}: {
  p: Product; rec?: ModelRecord; onClose: () => void; onRecord: (r: ModelRecord) => void; seller?: boolean;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [angles, setAngles] = useState(1);
  const building = rec && (rec.status === "queued" || rec.status === "running");

  async function build(force = false) {
    setBusy(true); setErr(null);
    try {
      const { record } = await generateProduct(p, { angles, force });
      onRecord(record);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,8,5,.45)", zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
      <aside onClick={(e) => e.stopPropagation()} style={{ width: "min(560px, 100%)", height: "100%", background: "var(--bg)", overflowY: "auto", boxShadow: "-20px 0 60px rgba(0,0,0,.25)" }}>
        <div style={{ position: "relative", aspectRatio: "1/1", background: "radial-gradient(ellipse at 50% 60%, var(--card), var(--bg-2))" }}>
          {rec?.glb ? (
            <ProductViewer src={rec.glb} usdz={rec.usdz} alt={p.title} poster={p.images[0]} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.images[0]} alt={p.title} style={{ width: "100%", height: "100%", objectFit: "contain", background: "#fff", filter: building ? "saturate(.6)" : undefined }} />
          )}
          {building && (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "color-mix(in srgb, var(--bg) 40%, transparent)" }}>
              <div className="card" style={{ padding: "16px 20px", textAlign: "center" }}>
                <span className="spin" style={{ color: "var(--accent)" }} />
                <div style={{ fontWeight: 700, marginTop: 8 }}>Lux3D is sculpting this product…</div>
                <div className="muted" style={{ fontSize: 13 }}>Usually about two minutes. You can keep browsing.</div>
              </div>
            </div>
          )}
          <button onClick={onClose} className="btn btn-sm" style={{ position: "absolute", top: 12, right: 12 }}>✕</button>
          <div style={{ position: "absolute", top: 12, left: 12 }}><StatusBadge rec={rec} /></div>
        </div>

        <div style={{ padding: 24 }}>
          <div className="faint" style={{ fontSize: 13, fontWeight: 600 }}>{p.domain.replace(/^www\./, "")}</div>
          <h2 className="display" style={{ fontSize: 30, margin: "4px 0 6px", lineHeight: 1.1 }}>{p.title}</h2>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{money(p.price)}</div>

          {!rec?.glb && !building && (
            <div className="card" style={{ padding: 16, marginTop: 20 }}>
              <div style={{ fontWeight: 700 }}>Not in 3D yet</div>
              <div className="muted" style={{ fontSize: 14, margin: "4px 0 12px" }}>
                Lux3D will build a textured 3D model from {angles === 1 ? "the main product photo" : `${angles} product photos`}.
              </div>
              {p.images.length > 1 && (
                <label className="muted" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  Photos to use
                  <select value={angles} onChange={(e) => setAngles(Number(e.target.value))} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "4px 8px", background: "var(--card)" }}>
                    {Array.from({ length: Math.min(4, p.images.length) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              )}
              <button className="btn btn-accent" disabled={busy} onClick={() => build(rec?.status === "failed")}>
                {busy ? <><span className="spin" /> Sending to Lux3D</> : rec?.status === "failed" ? "Try again" : "Build in 3D"}
              </button>
              {rec?.error && <div style={{ color: "var(--accent)", fontSize: 13, marginTop: 8 }}>{rec.error}</div>}
              {err && <div style={{ color: "var(--accent)", fontSize: 13, marginTop: 8 }}>{err}</div>}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 20 }}>
            {p.url && <a className="btn btn-primary" href={p.url} target="_blank" rel="noreferrer">Buy on {p.domain.replace(/^www\./, "")} ↗</a>}
            {rec?.glb && <Link className="btn" href={`/studio/ad?id=${encodeURIComponent(rec.id)}`}>Make a 3D ad</Link>}
            {rec?.glb && seller && <a className="btn" href={rec.glb} download>Download GLB</a>}
          </div>

          {p.images.length > 1 && (
            <div style={{ display: "flex", gap: 8, marginTop: 24, overflowX: "auto" }}>
              {p.images.slice(0, 6).map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={`${src}${src.includes("?") ? "&" : "?"}width=160`} alt="" style={{ width: 72, height: 72, objectFit: "contain", background: "#fff", borderRadius: 10, border: "1px solid var(--line)" }} />
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
