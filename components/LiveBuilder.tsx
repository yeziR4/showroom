"use client";
import { createElement, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { api, type ModelRecord } from "@/lib/client";
import ProductViewer from "./ProductViewer";
import { useProgress } from "@react-three/drei";
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
  const [share, setShare] = useState(true);
  const [modelError, setModelError] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const { progress: loadPct } = useProgress();
  const shareRef = useRef(share);
  shareRef.current = share;
  const fileRef = useRef<HTMLInputElement>(null);
  const jobRef = useRef(job);
  jobRef.current = job;

  // ticking clock for the timer
  useEffect(() => {
    if (!job || job.phase === "failed" || (job.finished && revealed)) return;
    const id = setInterval(() => setNow(Date.now()), job.finished ? 1000 : 100);
    return () => clearInterval(id);
  }, [job, revealed]);

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
    setPickError(null);
    const isHeic = /hei[cf]$/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
    if (!file.type.startsWith("image/") && !isHeic) {
      setPickError("That isn’t an image. Choose a JPG, PNG or WebP photo of a product.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setPickError("That photo is over 25 MB. Try a smaller one, or a screenshot of it.");
      return;
    }
    let image: string;
    try {
      image = await prepareImage(file);
    } catch {
      setPickError(isHeic
        ? "This browser can’t open iPhone HEIC photos. Export it as JPG (or take a screenshot) and try again."
        : "Couldn’t read that photo. Try a JPG or PNG.");
      return;
    }
    setRevealed(false);
    const title = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 60);
    const started = Date.now();
    setJob({ image, title, phase: "uploading", started, replay: false });
    try {
      const { record } = await api<{ record: ModelRecord }>("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "photo", image, title, public: shareRef.current }),
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

  function reset() { setJob(null); setRevealed(false); setModelError(false); }

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
  const slowLoad = !!job?.finished && !revealed && Date.now() - job.finished > 40_000;
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
          <input ref={fileRef} type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) start(f); }} />
          <div className="drop-icon">⬆</div>
          <div style={{ fontWeight: 700, fontSize: 20 }}>Drop a product photo</div>
          <div className="muted" style={{ fontSize: 14 }}>or click to choose · or paste · JPG / PNG</div>
          <div className="faint" style={{ fontSize: 12, marginTop: 10 }}>Best: one object, plain background. About a minute to build.</div>
        </div>
        {pickError && (
          <div role="alert" style={{ marginTop: 10, padding: "10px 14px", borderRadius: 12, background: "color-mix(in srgb, var(--accent) 10%, var(--card))", color: "var(--ink)", fontSize: 14 }}>
            {pickError}
          </div>
        )}
        <label className="muted" style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginTop: 10 }}>
          <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
          Add my model to the public showcase
        </label>
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
        <div className="build-stage" ref={stageRef}>
          <BuildStage image={job.image} glb={glb} phase={job.phase} speed={job.replay ? 1.6 : 1} onModelError={() => setModelError(true)} onRevealed={() => {
            setRevealed(true);
            // If they scrolled down to play with an example, bring them back for the reveal.
            const r = stageRef.current?.getBoundingClientRect();
            if (r && (r.top < 64 || r.bottom > window.innerHeight)) stageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            const rec = jobRef.current?.record;
            if (rec?.glb && rec.kind === "photo" && rec.public !== false && !jobRef.current?.replay) {
              window.dispatchEvent(new CustomEvent("showroom:built", { detail: rec }));
            }
          }} />

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
                {done && (
                  <li data-state="active">
                    <span className="dot" />
                    {job.replay ? "Loading the 3D model" : "Model ready — loading it into your browser"}
                    {loadPct > 0 && loadPct < 100 ? ` · ${Math.round(loadPct)}%` : "…"}
                  </li>
                )}
              </ol>
              {done && !modelError && slowLoad && (
                <div className="tip" style={{ opacity: 0.9 }}>
                  Taking a while on this connection.{" "}
                  <a href={glb} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>Open the model file</a> or keep waiting.
                </div>
              )}
              <div className="bar"><div style={{ width: `${progress * 100}%` }} /></div>
              <div className="tip">{TIPS[tip]}</div>
            </div>
          )}

          {modelError && !revealed && (
            <div className="hud hud-center">
              <div style={{ fontWeight: 700, fontSize: 18 }}>Lux3D built it, but your browser couldn’t display it</div>
              <div style={{ opacity: 0.8, fontSize: 14, margin: "6px 0 14px", maxWidth: 340 }}>The 3D file is fine — you can download it, or try again on another browser.</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                {glb && <a className="btn btn-accent" href={glb} download>Download GLB</a>}
                <button className="btn" onClick={reset}>Build another</button>
              </div>
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

      {!job.replay && !revealed && job.phase !== "failed" && examples.length > 0 && (
        <WhileYouWait
          examples={examples}
          timer={fmt(elapsed)}
          step={done ? "Model ready — loading it" : STEPS[activeStep].label}
          progress={progress}
          onJumpBack={() => stageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
        />
      )}

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

// Shown under the live build: a pre-generated model to play with while waiting,
// with a compact progress line so the wait stays visible.
function WhileYouWait({
  examples, timer, step, progress, onJumpBack,
}: { examples: ModelRecord[]; timer: string; step: string; progress: number; onJumpBack: () => void }) {
  const list = examples.filter((m) => m.glb);
  const [i, setI] = useState(0);
  const m = list[i % list.length];
  if (!m) return null;
  const go = (d: number) => setI((x) => (x + d + list.length) % list.length);
  return (
    <div className="wait-card card">
      <div className="wait-head">
        <div>
          <div style={{ fontWeight: 700 }}>While Lux3D works on yours, spin one we built earlier</div>
          <div className="muted" style={{ fontSize: 13 }}>Drag to rotate, pinch or scroll to zoom — this is exactly what you’ll get.</div>
        </div>
        <button className="wait-progress" onClick={onJumpBack} title="Back to your build">
          <span className="wait-dot" />
          <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 600 }}>{timer}</span>
          <span className="wait-step">{step}</span>
          <span className="wait-bar"><span style={{ width: `${Math.round(progress * 100)}%` }} /></span>
        </button>
      </div>
      <div className="wait-body">
        <div className="wait-viewer">
          <ProductViewer key={m.id} src={m.glb!} usdz={m.usdz} alt={m.title} poster={m.image} />
          <span className="pill" style={{ position: "absolute", left: 12, top: 12 }}>Example · built earlier</span>
        </div>
        <div className="wait-side">
          {m.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.image.startsWith("https://cdn.shopify.com") ? `${m.image}${m.image.includes("?") ? "&" : "?"}width=300` : m.image} alt="" className="wait-photo" />
          )}
          <div className="faint" style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em" }}>BUILT FROM THIS PHOTO</div>
          <div style={{ fontWeight: 600, fontSize: 14, marginTop: 4 }}>{m.title}</div>
          <div className="faint" style={{ fontSize: 13 }}>{m.domain === "demo" ? "Lux3D sample" : m.domain?.replace(/^www\./, "")}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            <button className="btn btn-sm" onClick={() => go(-1)} aria-label="Previous example">←</button>
            <span className="faint" style={{ fontSize: 13, alignSelf: "center" }}>{(i % list.length) + 1} / {list.length}</span>
            <button className="btn btn-sm" onClick={() => go(1)} aria-label="Next example">→</button>
          </div>
        </div>
      </div>
    </div>
  );
}
