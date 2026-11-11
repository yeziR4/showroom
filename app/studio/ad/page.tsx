"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, money, type ModelRecord } from "@/lib/client";
import type { Template } from "@/components/AdRenderer";

const AdRenderer = dynamic(() => import("@/components/AdRenderer"), { ssr: false });

const FORMATS = {
  story: { label: "9:16 · TikTok / Reels", w: 720, h: 1280 },
  square: { label: "1:1 · Feed", w: 900, h: 900 },
  wide: { label: "16:9 · YouTube", w: 1280, h: 720 },
} as const;
type Format = keyof typeof FORMATS;

const THEMES = {
  cream: { label: "Studio", bg: ["#f6f1e9", "#e4dacb"], ink: "#17140f", accent: "#ff5a1f" },
  midnight: { label: "Midnight", bg: ["#1b1d2a", "#07080d"], ink: "#ffffff", accent: "#8ab4ff" },
  sunset: { label: "Sunset", bg: ["#ffb36b", "#ff4f7b"], ink: "#ffffff", accent: "#2b0b3a" },
  electric: { label: "Electric", bg: ["#3b2bff", "#00d2ff"], ink: "#ffffff", accent: "#ffe14d" },
  mint: { label: "Mint", bg: ["#d9fff1", "#9ee6cf"], ink: "#0b3b2e", accent: "#0b7a5b" },
} as const;
type Theme = keyof typeof THEMES;

const TEMPLATES: { id: Template; label: string; what: string }[] = [
  { id: "drop", label: "Drop", what: "Lands with a bounce, then turns" },
  { id: "reveal", label: "Reveal", what: "Lights up out of the dark" },
  { id: "orbit", label: "Orbit", what: "Sweeping camera fly-around" },
  { id: "spin", label: "Spin", what: "Clean turntable push-in" },
];

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const seg = (u: number, a: number, b: number) => Math.min(1, Math.max(0, (u - a) / (b - a)));

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/); const lines: string[] = []; let line = "";
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

// ---- soundtrack: a tiny synthesized beat, routed into the recording ----
function startBeat(ctx: AudioContext, dest: AudioNode, seconds: number) {
  const bpm = 112, beat = 60 / bpm, t0 = ctx.currentTime + 0.05;
  const master = ctx.createGain(); master.gain.value = 0.5; master.connect(dest);
  const chords = [[220, 277.2, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 246.9, 293.7]];
  for (let i = 0; i * beat < seconds; i++) {
    const t = t0 + i * beat;
    // kick
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.3);
    // off-beat hat
    const n = ctx.createBufferSource(); const buf = ctx.createBuffer(1, 2205, 44100);
    const d = buf.getChannelData(0); for (let k = 0; k < d.length; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / d.length);
    n.buffer = buf; const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 7000;
    const hg = ctx.createGain(); hg.gain.value = 0.25; n.connect(hp).connect(hg).connect(master); n.start(t + beat / 2);
    // pad every bar
    if (i % 4 === 0) {
      for (const f of chords[(i / 4) % chords.length]) {
        const po = ctx.createOscillator(), pg = ctx.createGain(); po.type = "triangle"; po.frequency.value = f;
        pg.gain.setValueAtTime(0, t); pg.gain.linearRampToValueAtTime(0.06, t + 0.3); pg.gain.linearRampToValueAtTime(0, t + beat * 4);
        po.connect(pg).connect(master); po.start(t); po.stop(t + beat * 4);
      }
    }
  }
  return () => master.disconnect();
}

export default function AdStudioPage() {
  return <Suspense><AdStudio /></Suspense>;
}

function AdStudio() {
  const params = useSearchParams();
  const [rec, setRec] = useState<ModelRecord | null>(null);
  const [choices, setChoices] = useState<ModelRecord[]>([]);
  const [format, setFormat] = useState<Format>("story");
  const [theme, setTheme] = useState<Theme>("sunset");
  const [template, setTemplate] = useState<Template>("drop");
  const [duration, setDuration] = useState(8);
  const [headline, setHeadline] = useState("");
  const [price, setPrice] = useState("");
  const [cta, setCta] = useState("");
  const [music, setMusic] = useState(true);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [video, setVideo] = useState<{ url: string; ext: string } | null>(null);

  const timeRef = useRef(0);
  const glCanvas = useRef<HTMLCanvasElement | null>(null);
  const out = useRef<HTMLCanvasElement>(null);
  const start = useRef(performance.now());
  const recState = useRef<{ startedAt: number } | null>(null);
  const settings = useRef({ format, theme, duration, headline, price, cta });
  // ?freeze=0.8 pins the timeline (for thumbnails and visual checks).
  const freezeParam = params.get("freeze");
  const freeze = freezeParam !== null ? Number(freezeParam) : null;
  settings.current = { format, theme, duration, headline, price, cta };

  useEffect(() => {
    const id = params.get("id");
    api<{ models: ModelRecord[] }>(`/api/models${id ? `?id=${encodeURIComponent(id)}` : ""}`).then((r) => {
      setChoices(r.models);
      const pick = (id && r.models.find((m) => m.id === id)) || r.models[0];
      if (pick) choose(pick);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function choose(m: ModelRecord) {
    setRec(m);
    setHeadline(m.title.split(" - ")[0].slice(0, 48));
    setPrice(m.price ? money(m.price) : "");
    setCta(m.domain && m.domain !== "demo" ? `Shop now · ${m.domain.replace(/^www\./, "")}` : "Shop now");
    setVideo(null);
  }

  // Compositor: background gradient + 3D frame + animated typography.
  useEffect(() => {
    let raf = 0;
    // next/font gives the fonts hashed family names; read them from the CSS variables.
    const css = getComputedStyle(document.documentElement);
    const DISPLAY = css.getPropertyValue("--font-display").trim() || "Georgia, serif";
    const SANS = css.getPropertyValue("--font-sans").trim() || "system-ui, sans-serif";
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const s = settings.current; const f = FORMATS[s.format]; const th = THEMES[s.theme];
      const c = out.current; if (!c) return;
      if (c.width !== f.w) c.width = f.w;
      if (c.height !== f.h) c.height = f.h;
      const ctx = c.getContext("2d")!;
      const now = performance.now();
      let u: number;
      if (freeze !== null) {
        u = freeze;
      } else if (recState.current) {
        u = Math.min(1, (now - recState.current.startedAt) / 1000 / s.duration);
      } else {
        // Preview loops with a short hold at the end.
        const loop = s.duration + 1.2;
        u = Math.min(1, (((now - start.current) / 1000) % loop) / s.duration);
      }
      timeRef.current = u;

      const W = f.w, H = f.h, portrait = H > W, unit = Math.min(W, H) / 100;
      const g = ctx.createLinearGradient(0, 0, W * 0.3, H);
      g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // soft spotlight behind the product
      const rg = ctx.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, Math.max(W, H) * 0.55);
      rg.addColorStop(0, "rgba(255,255,255,0.35)"); rg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);

      if (glCanvas.current) {
        const gc = glCanvas.current;
        // Product sits a little low in portrait so the headline has room.
        const square = !portrait && W / H < 1.2;
        const k = square ? 0.8 : 1;
        const dy = portrait ? H * 0.06 : square ? H * 0.17 : 0;
        const dx = !portrait && W / H > 1.5 ? W * 0.16 : (W - W * k) / 2;
        ctx.drawImage(gc, dx, dy, W * k, H * k);
      }

      ctx.fillStyle = th.ink; ctx.textBaseline = "alphabetic";
      const pad = unit * 7;
      const leftCol = !portrait && W / H > 1.5;
      const textX = leftCol ? pad : W / 2;
      ctx.textAlign = leftCol ? "left" : "center";

      // Headline
      const a1 = ease(seg(u, 0.06, 0.22));
      ctx.globalAlpha = a1;
      const hs = unit * (portrait ? 9 : leftCol ? 7.2 : 8);
      ctx.font = `600 ${hs}px ${DISPLAY}`;
      const lines = wrapText(ctx, s.headline, leftCol ? W * 0.42 : W - pad * 2);
      const top = leftCol ? H * 0.3 : pad + hs;
      lines.forEach((l, i) => ctx.fillText(l, textX, top + i * hs * 1.05 + (1 - a1) * unit * 4));

      // Price chip
      const a2 = ease(seg(u, 0.32, 0.45));
      if (s.price && a2 > 0) {
        ctx.globalAlpha = a2;
        ctx.font = `700 ${unit * 5.5}px ${SANS}`;
        const tw = ctx.measureText(s.price).width;
        const cw = tw + unit * 6, ch = unit * 9;
        const cx = leftCol ? pad : W / 2 - cw / 2;
        const cy = top + lines.length * hs * 1.05 + unit * 2;
        const sc = 0.8 + 0.2 * a2;
        ctx.save(); ctx.translate(cx + cw / 2, cy + ch / 2); ctx.scale(sc, sc);
        ctx.fillStyle = th.accent; roundRect(ctx, -cw / 2, -ch / 2, cw, ch, ch / 2); ctx.fill();
        ctx.fillStyle = th.accent === "#ffe14d" || th.accent === "#8ab4ff" ? "#111" : "#fff";
        ctx.textAlign = "center"; ctx.fillText(s.price, 0, unit * 2);
        ctx.restore();
        ctx.textAlign = leftCol ? "left" : "center";
      }

      // Call to action
      const a3 = ease(seg(u, 0.7, 0.84));
      if (a3 > 0) {
        ctx.globalAlpha = a3;
        ctx.font = `700 ${unit * 4.6}px ${SANS}`;
        const tw = ctx.measureText(s.cta).width;
        const bw = tw + unit * 10, bh = unit * 11;
        const bx = leftCol ? pad : W / 2 - bw / 2;
        const by = H - pad - bh - unit * 4 + (1 - a3) * unit * 5;
        ctx.fillStyle = th.ink; roundRect(ctx, bx, by, bw, bh, bh / 2); ctx.fill();
        ctx.fillStyle = th.bg[0];
        ctx.textAlign = "center"; ctx.fillText(s.cta, bx + bw / 2, by + bh / 2 + unit * 1.6);
        ctx.textAlign = leftCol ? "left" : "center";
      }

      // Watermark
      ctx.globalAlpha = 0.55; ctx.fillStyle = th.ink;
      ctx.font = `600 ${unit * 2.4}px ${SANS}`;
      ctx.textAlign = "center";
      ctx.fillText("3D by Showroom × Aholo Lux3D", W / 2, H - unit * 3);
      ctx.globalAlpha = 1;

      if (recState.current) setProgress(u);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const record = useCallback(async () => {
    const c = out.current; if (!c || recording) return;
    setVideo(null); setRecording(true); setProgress(0);
    const stream = c.captureStream(30);
    let stopAudio: (() => void) | null = null; let actx: AudioContext | null = null;
    if (music) {
      actx = new AudioContext();
      const dest = actx.createMediaStreamDestination();
      stopAudio = startBeat(actx, dest, duration + 0.5);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    }
    const types = ["video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"];
    const mime = types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "video/webm";
    const mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.onstop = () => {
      const blob = new Blob(chunks, { type: mime.split(";")[0] });
      setVideo({ url: URL.createObjectURL(blob), ext: mime.includes("mp4") ? "mp4" : "webm" });
      setRecording(false); recState.current = null; start.current = performance.now();
      stopAudio?.(); actx?.close();
    };
    recState.current = { startedAt: performance.now() };
    mr.start(250);
    setTimeout(() => mr.stop(), (duration + 0.6) * 1000);
  }, [duration, music, recording]);

  const f = FORMATS[format];

  return (
    <main className="wrap" style={{ paddingTop: 24 }}>
      <Link href="/studio" className="faint" style={{ fontSize: 13 }}>← Seller studio</Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow" style={{ marginTop: 8 }}>3D ad studio</div>
          <h1 className="display" style={{ fontSize: "clamp(32px, 5vw, 48px)", margin: "4px 0 0", lineHeight: 1 }}>Make a product ad in one click</h1>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 380px)", gap: 24, marginTop: 20, alignItems: "start" }} data-ad>
        <div className="card" style={{ padding: 16, display: "grid", placeItems: "center", background: "var(--bg-2)", minHeight: 420 }}>
          <canvas ref={out} style={{ width: "100%", maxWidth: format === "story" ? 380 : format === "square" ? 560 : 820, aspectRatio: `${f.w} / ${f.h}`, borderRadius: 14, boxShadow: "0 20px 50px -20px rgba(0,0,0,.4)" }} />
          {!rec && <p className="muted">No 3D products yet — build one in the seller studio first.</p>}
        </div>

        <div className="card" style={{ padding: 18, display: "grid", gap: 16 }}>
          <Field label="Product">
            <select value={rec?.id ?? ""} onChange={(e) => { const m = choices.find((c) => c.id === e.target.value); if (m) choose(m); }} style={selectStyle}>
              {choices.map((m) => <option key={m.id} value={m.id}>{m.title.slice(0, 60)}</option>)}
            </select>
          </Field>
          <Field label="Motion">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => { setTemplate(t.id); start.current = performance.now(); }} className="btn btn-sm"
                  style={{ flexDirection: "column", alignItems: "flex-start", borderRadius: 12, padding: 10, whiteSpace: "normal", textAlign: "left", ...(template === t.id ? { background: "var(--ink)", color: "var(--bg)" } : {}) }}>
                  <span>{t.label}</span><span style={{ fontWeight: 400, fontSize: 11, opacity: 0.7 }}>{t.what}</span>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Format">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(Object.keys(FORMATS) as Format[]).map((k) => (
                <button key={k} className={`btn btn-sm ${format === k ? "btn-primary" : ""}`} onClick={() => setFormat(k)}>{FORMATS[k].label}</button>
              ))}
            </div>
          </Field>
          <Field label="Look">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(Object.keys(THEMES) as Theme[]).map((k) => (
                <button key={k} title={THEMES[k].label} onClick={() => setTheme(k)}
                  style={{ width: 34, height: 34, borderRadius: 10, border: theme === k ? "2px solid var(--ink)" : "1px solid var(--line)", background: `linear-gradient(135deg, ${THEMES[k].bg[0]}, ${THEMES[k].bg[1]})` }} />
              ))}
            </div>
          </Field>
          <Field label="Headline"><input className="input" style={inputStyle} value={headline} onChange={(e) => setHeadline(e.target.value)} /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
            <Field label="Price"><input className="input" style={inputStyle} value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
            <Field label="Call to action"><input className="input" style={inputStyle} value={cta} onChange={(e) => setCta(e.target.value)} /></Field>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <Field label={`Length · ${duration}s`}>
              <input type="range" min={5} max={15} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </Field>
            <label className="muted" style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={music} onChange={(e) => setMusic(e.target.checked)} /> Soundtrack
            </label>
          </div>
          <button className="btn btn-accent btn-lg" disabled={!rec || recording} onClick={record}>
            {recording ? <><span className="spin" /> Recording {Math.round(progress * 100)}%</> : "● Export video"}
          </button>
          {video && (
            <div style={{ display: "grid", gap: 8 }}>
              <video src={video.url} controls playsInline style={{ width: "100%", borderRadius: 12, background: "#000" }} />
              <a className="btn btn-primary" href={video.url} download={`showroom-ad-${format}.${video.ext}`}>Download {video.ext.toUpperCase()}</a>
            </div>
          )}
        </div>
      </div>

      {rec?.glb && (
        <AdRenderer glb={rec.glb} template={template} timeRef={timeRef} width={f.w} height={f.h} onCanvas={(c) => { glCanvas.current = c; }} />
      )}
      <style>{`@media (max-width: 900px){ [data-ad]{ grid-template-columns: 1fr !important } }`}</style>
    </main>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <span className="faint" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</span>
      {children}
    </div>
  );
}

const selectStyle: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", background: "var(--card)", width: "100%" };
const inputStyle: React.CSSProperties = { padding: "10px 14px", fontSize: 14, borderRadius: 12 };
