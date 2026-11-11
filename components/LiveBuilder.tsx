"use client";
import { createElement, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { api, type ModelRecord } from "@/lib/client";
import type { BuildPhase } from "./BuildStage";

const BuildStage = dynamic(() => import("./BuildStage"), { ssr: false });

// Stage labels shown while Lux3D works. Only "uploaded" and "done" are real
// events; the steps in between are timed estimates (labelled as such).
const STEPS: { label: string; at: number }[] = [
  { label: "Photo sent to Aholo", at: 0 },
  { label: "Lux3D reads the silhouette", at: 4 },
  { label: "Sculpting the geometry", at: 16 },
  { label: "Painting PBR materials", at: 34 },
  { label: "Packing the 3D file", at: 52 },
];

const TIPS = [
  "Every particle is a pixel from your photo.",
  "Lux3D infers the back of the object — the side the camera never saw.",
  "Materials are physically based: metal, glass and ceramic react to light.",
  "The result is a standard GLB you can use in Shopify, AR or a game engine.",
  "One photo is enough. More angles make it even better.",
];

// Downscale in the browser so uploads stay small (Vercel caps request bodies).
async function prepareImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 1024 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const g = c.getContext("2d")!;
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function fmt(ms: number) {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${(s % 60).toFixed(1).padStart(4, "0")}`;
}

type Job = {
  image: string;          // what the particles are made of
  title: string;
  record?: ModelRecord;
  phase: BuildPhase;
  started: number;        // local clock
  finished?: number;
  replay: boolean;        // example that was built earlier — replayed fast
  error?: string;
};

export default function LiveBuilder({ examples }: { examples: ModelRecord[] }) {
  const [job, setJob] = useState<Job | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [drag, setDrag] = useState(false);
  const [tip, setTip] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const jobRef = useRef(job);
  jobRef.current = job;

  // ticking clock for the timer
  useEffect(() => {
    if (!job || job.finished || job.phase === "failed") return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [job]);

  useEffect(() => {
    if (!job || revealed) return;
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 5000);
    return () => clearInterval(id);
  }, [job, revealed]);

  // poll Lux3D
  useEffect(() => {
    if (!job?.record || job.phase !== "building" || job.replay) return;
    const id = setInterval(async () => {
      const cur = jobRef.current;
      if (!cur?.record) return;
      try {
        const { record } = await api<{ record: ModelRecord }>("/api/task", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ record: cur.record }),
        });
        if (record.status === "succeeded" && record.glb) setJob((j) => j && { ...j, record, phase: "done", finished: Date.now() });
        else if (record.status === "failed") setJob((j) => j && { ...j, record, phase: "failed", error: record.error ?? "Lux3D couldn't build this one. Try a clearer photo on a plain background." });
        else setJob((j) => j && { ...j, record });
      } catch { /* keep polling */ }
    }, 4000);
    return () => clearInterval(id);
  }, [job?.record?.id, job?.phase, job?.replay]);

  const start = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setRevealed(false);
    const image = await prepareImage(file);
    const title = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 60);
    const started = Date.now();
    setJob({ image, title, phase: "uploading", started, replay: false });
    try {
      const { record } = await api<{ record: ModelRecord }>("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "photo", image, title }),
      });
      // Same photo built before: show it straight away, honestly labelled.
      if (record.status === "succeeded" && record.glb) {
        setJob({ image, title, record, phase: "building", started, replay: true });
        setTimeout(() => setJob((j) => j && { ...j, phase: "done", finished: Date.now() }), 4200);
      } else {
        setJob((j) => j && { ...j, record, phase: "building" });
      }
    } catch (e) {
      setJob((j) => j && { ...j, phase: "failed", error: (e as Error).message });
    }
  }, []);

  function replay(m: ModelRecord) {
    if (!m.image || !m.glb) return;
    setRevealed(false);
    const started = Date.now();
    setJob({ image: m.image, title: m.title, record: m, phase: "building", started, replay: true });
    setTimeout(() => setJob((j) => (j?.record?.id === m.id ? { ...j, phase: "done", finished: Date.now() } : j)), 4200);
  }

  function reset() { setJob(null); setRevealed(false); }

  // paste an image from the clipboard
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.files ?? []).find((x) => x.type.startsWith("image/"));
      if (f) start(f);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [start]);

  const elapsed = job ? (job.finished ?? now) - job.started : 0;
  // Replays run the stage list at 15× so they read as a replay, not a fake live build.
  const stepClock = job?.replay ? elapsed * 15 : elapsed;
  const activeStep = job?.phase === "uploading" ? 0 : STEPS.reduce((acc, s, i) => (stepClock / 1000 >= s.at ? i : acc), 0);
  const progress = !job ? 0 : job.phase === "done" ? 1 : job.replay ? Math.min(0.95, elapsed / 4200) : 1 - Math.exp(-elapsed / 1000 / 32);

  // ---- idle: drop zone ----
  if (!job) {
    return (
      <div>
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) start(f); }}
          onClick={() => fileRef.current?.click()}
          className="dropzone"
          data-drag={drag || undefined}
        >
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && start(e.target.files[0])} />
          <div className="drop-icon">⬆</div>
          <div style={{ fontWeight: 700, fontSize: 20 }}>Drop a product photo</div>
          <div className="muted" style={{ fontSize: 14 }}>or click to choose · or paste · JPG / PNG</div>
          <div className="faint" style={{ fontSize: 12, marginTop: 10 }}>Best: one object, plain background. About a minute to build.</div>
        </div>
        {examples.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="faint" style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>NO PHOTO HANDY? REPLAY ONE BUILT EARLIER</div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              {examples.filter((m) => m.image).slice(0, 8).map((m) => (
                <button key={m.id} onClick={() => replay(m)} className="card" title={m.title}
                  style={{ padding: 0, width: 76, height: 76, flex: "0 0 auto", overflow: "hidden", background: "#fff" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.image!.startsWith("https://cdn.shopify.com") ? `${m.image}${m.image!.includes("?") ? "&" : "?"}width=200` : m.image} alt={m.title} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---- building / done ----
  const done = job.phase === "done";
  const glb = job.record?.glb;
  return (
    <div>
      <div className="build-grid">
        <div className="build-photo card">
          <div className="build-label">{job.replay ? "Product photo" : "Your photo"}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={job.image} alt="" />
        </div>
        <div className="build-arrow" aria-hidden>→</div>
        <div className="build-stage">
          <BuildStage image={job.image} glb={glb} phase={job.phase} speed={job.replay ? 1.6 : 1} onRevealed={() => setRevealed(true)} />

          <div className="hud hud-top">
            <span className={`hud-pill ${done ? "ok" : "live"}`}>
              {job.replay
                ? job.record?.kind === "photo" ? "● Same photo as before · model reused" : "● Example · built earlier, replayed"
                : done ? "● Built live by Lux3D" : "● Live build · Lux3D"}
            </span>
            <span className="hud-timer">{job.replay && done && job.record?.createdAt ? "" : fmt(elapsed)}</span>
          </div>

          {!revealed && job.phase !== "failed" && (
            <div className="hud hud-bottom">
              <ol className="steps">
                {STEPS.map((s, i) => (
                  <li key={s.label} data-state={done || i < activeStep ? "done" : i === activeStep ? "active" : "todo"}>
                    <span className="dot" />{s.label}
                  </li>
                ))}
              </ol>
              <div className="bar"><div style={{ width: `${progress * 100}%` }} /></div>
              <div className="tip">{TIPS[tip]}</div>
            </div>
          )}

          {job.phase === "failed" && (
            <div className="hud hud-center">
              <div style={{ fontWeight: 700, fontSize: 18 }}>That one didn’t work</div>
              <div style={{ opacity: 0.8, fontSize: 14, margin: "6px 0 14px", maxWidth: 320 }}>{job.error}</div>
              <button className="btn btn-accent" onClick={reset}>Try another photo</button>
            </div>
          )}

          {revealed && (
            <div className="hud hud-bottom" style={{ background: "transparent", pointerEvents: "none" }}>
              <div style={{ fontSize: 13, opacity: 0.8 }}>Drag to spin · scroll to zoom</div>
            </div>
          )}
        </div>
      </div>

      {revealed && glb && (
        <div className="next-row">
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>
              {job.replay
                ? job.record?.kind === "photo" ? "Lux3D already built this photo, so we reused the model (no credits spent)" : "Example model, built earlier by Lux3D"
                : `Done — your 3D model was built in ${((job.finished! - job.started) / 1000).toFixed(1)}s`}
            </div>
            <div className="muted" style={{ fontSize: 14 }}>Now put it to work:</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ArButton glb={glb} title={job.title} />
            {job.record && <Link className="btn btn-accent" href={`/studio/ad?id=${encodeURIComponent(job.record.id)}`}>Make a 3D video ad</Link>}
            <a className="btn" href={glb} download>Download GLB</a>
            <button className="btn btn-ghost" onClick={reset}>Build another</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Opens the phone's native AR viewer through a hidden <model-viewer>.
function ArButton({ glb, title }: { glb: string; title: string }) {
  const ref = useRef<HTMLElement & { activateAR?: () => void; canActivateAR?: boolean }>(null);
  const [can, setCan] = useState<boolean | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setCan(Boolean(ref.current?.canActivateAR)), 1500);
    return () => clearTimeout(t);
  }, [glb]);
  return (
    <>
      {createElement("model-viewer", {
        ref, src: glb, alt: title, ar: "", "ar-modes": "webxr scene-viewer quick-look", "ar-scale": "auto",
        style: { position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" },
      })}
      <button className="btn btn-primary" onClick={() => ref.current?.activateAR?.()} disabled={can === false}
        title={can === false ? "Open this page on a phone to place it in your room" : undefined}>
        {can === false ? "View in your room (on phone)" : "View in your room"}
      </button>
    </>
  );
}
