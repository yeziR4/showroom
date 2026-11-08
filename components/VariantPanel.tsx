"use client";
import { useState } from "react";
import ProductViewer from "./ProductViewer";
import { api, type ModelRecord } from "@/lib/client";

// Colour / material variants via Lux3D material transfer.
const PRESETS: { label: string; colors: [string, string] }[] = [
  { label: "Midnight", colors: ["#111318", "#2a2d36"] },
  { label: "Ocean", colors: ["#0f4c81", "#2f7fc1"] },
  { label: "Forest", colors: ["#1e4d2b", "#3c7a4f"] },
  { label: "Sand", colors: ["#d8c3a0", "#efe0c4"] },
  { label: "Crimson", colors: ["#8c1022", "#c4283e"] },
  { label: "Blush", colors: ["#e8b4b8", "#f6d6d8"] },
];

// Draws a fabric-like swatch so the material transfer has some texture to read.
function swatchDataUrl(a: string, b: string): string {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, a); grad.addColorStop(1, b);
  g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(${Math.random() > 0.5 ? "255,255,255" : "0,0,0"},${Math.random() * 0.06})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  return c.toDataURL("image/png");
}

export default function VariantPanel({ parent, variants, onRecord }: { parent: ModelRecord; variants: ModelRecord[]; onRecord: (r: ModelRecord) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [show, setShow] = useState<string>(parent.id);

  async function make(label: string, swatch: string) {
    setBusy(label); setErr(null);
    try {
      const { record } = await api<{ record: ModelRecord }>("/api/variant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: parent.id, label, swatch }),
      });
      onRecord(record);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }

  function upload(file: File) {
    const r = new FileReader();
    r.onload = () => make(file.name.replace(/\.[^.]+$/, "").slice(0, 24) || "Custom", String(r.result));
    r.readAsDataURL(file);
  }

  const all = [parent, ...variants];
  const current = all.find((v) => v.id === show) ?? parent;

  return (
    <div>
      <div style={{ aspectRatio: "4/3", background: "radial-gradient(ellipse at 50% 60%, var(--card), var(--bg-2))", borderRadius: 14, position: "relative", overflow: "hidden" }}>
        {current.glb ? <ProductViewer src={current.glb} usdz={current.usdz} alt={current.title} /> : (
          <div style={{ height: "100%", display: "grid", placeItems: "center" }}><span className="muted"><span className="spin" /> Lux3D is repainting “{current.label}”…</span></div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
        {all.map((v) => (
          <button key={v.id} className={`btn btn-sm ${v.id === show ? "btn-primary" : ""}`} onClick={() => setShow(v.id)}>
            {v.id === parent.id ? "Original" : v.label}
            {v.status !== "succeeded" && v.id !== parent.id && <span className="spin" style={{ width: 10, height: 10 }} />}
          </button>
        ))}
      </div>
      <div className="muted" style={{ fontSize: 13, margin: "16px 0 8px" }}>Add a colourway — Lux3D repaints the model’s materials:</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {PRESETS.filter((p) => !variants.some((v) => v.label === p.label)).map((p) => (
          <button key={p.label} className="btn btn-sm" disabled={!!busy} onClick={() => make(p.label, swatchDataUrl(...p.colors))}>
            <span style={{ width: 14, height: 14, borderRadius: 4, background: `linear-gradient(135deg, ${p.colors[0]}, ${p.colors[1]})` }} />
            {busy === p.label ? "…" : p.label}
          </button>
        ))}
        <label className="btn btn-sm" style={{ cursor: "pointer" }}>
          + Upload swatch photo
          <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
      </div>
      {err && <div style={{ color: "var(--accent)", fontSize: 13, marginTop: 8 }}>{err}</div>}
    </div>
  );
}
