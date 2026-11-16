"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { ModelRecord } from "@/lib/client";
import type { BuildPhase } from "./BuildStage";

const BuildStage = dynamic(() => import("./BuildStage"), { ssr: false });

const ASSEMBLE_MS = 4800; // particles assemble, inflate and get scanned
const HOLD_MS = 5200;     // the finished model spins on stage

function thumb(src: string) {
  return src.startsWith("https://cdn.shopify.com") ? `${src}${src.includes("?") ? "&" : "?"}width=240` : src;
}

// The hero: plays the real photo → particles → Lux3D model sequence on a loop,
// using the same stage as a live build, so the first thing a visitor sees is
// exactly what happens to their own photo.
export default function HeroLoop({ models }: { models: ModelRecord[] }) {
  const list = models.filter((m) => m.image && m.glb);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<BuildPhase>("building");
  const [revealed, setRevealed] = useState(false);
  const m = list[i % Math.max(1, list.length)];

  useEffect(() => {
    if (!m) return;
    setPhase("building");
    setRevealed(false);
    const t = setTimeout(() => setPhase("done"), ASSEMBLE_MS);
    return () => clearTimeout(t);
  }, [i, m?.id]);

  useEffect(() => {
    if (!revealed) return;
    const t = setTimeout(() => setI((x) => x + 1), HOLD_MS);
    return () => clearTimeout(t);
  }, [revealed]);

  if (!m) return null;
  const source = m.kind === "photo" ? "Uploaded photo" : m.domain?.replace(/^www\./, "");

  return (
    <div className="hero-stage">
      <BuildStage key={m.id + i} image={m.image!} glb={m.glb} phase={phase} speed={1.15} onRevealed={() => setRevealed(true)} />
      <div className="hero-hud-top">
        <span className="hero-chip"><span className={`hero-dot ${revealed ? "ok" : ""}`} />{revealed ? "3D model · Lux3D" : "Photo → 3D · Lux3D"}</span>
        <span className="hero-chip faint-chip">{(i % list.length) + 1} / {list.length}</span>
      </div>
      <div className="hero-source">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb(m.image!)} alt="" />
        <div>
          <div className="hero-source-label">Built from this photo</div>
          <div className="hero-source-title">{m.title}</div>
          <div className="hero-source-sub">{source}</div>
        </div>
      </div>
      <div className="hero-dots" aria-hidden>
        {list.slice(0, 10).map((x, k) => (
          <button key={x.id} className={k === i % list.length ? "on" : ""} onClick={() => setI(k)} aria-label={`Show ${x.title}`} />
        ))}
      </div>
    </div>
  );
}
