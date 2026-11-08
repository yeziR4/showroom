"use client";
import type { ModelRecord, Product } from "@/lib/client";
import { money } from "@/lib/client";

export function StatusBadge({ rec }: { rec?: ModelRecord }) {
  if (!rec) return null;
  if (rec.status === "succeeded") return <span className="pill pill-live">● 3D ready</span>;
  if (rec.status === "failed") return <span className="pill">Couldn't build</span>;
  return (
    <span className="pill pill-accent">
      <span className="spin" style={{ width: 10, height: 10 }} /> Building 3D
    </span>
  );
}

export default function ProductCard({
  p, rec, onOpen, showStore = false,
}: { p: Product; rec?: ModelRecord; onOpen: () => void; showStore?: boolean }) {
  return (
    <button onClick={onOpen} className="card" style={{ padding: 0, overflow: "hidden", textAlign: "left", color: "inherit" }}>
      <div style={{ aspectRatio: "1/1", background: "#fff", position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${p.images[0]}${p.images[0].includes("?") ? "&" : "?"}width=480`} alt={p.title} loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        <div style={{ position: "absolute", left: 10, top: 10 }}><StatusBadge rec={rec} /></div>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3 }}>{p.title}</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 13 }}>
          <span className="faint">{showStore ? p.domain.replace(/^www\./, "") : p.type || p.vendor}</span>
          <span style={{ fontWeight: 600 }}>{money(p.price)}</span>
        </div>
      </div>
    </button>
  );
}
