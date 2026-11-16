"use client";
import { Suspense, createElement, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { api, type ModelRecord } from "@/lib/client";
import { enableAr } from "@/lib/ar";

export default function ArPage() {
  return <Suspense><ArView /></Suspense>;
}

type MV = HTMLElement & { canActivateAR?: boolean; activateAR?: () => Promise<void> };
type Support = "checking" | "yes" | "no";

function environment() {
  if (typeof navigator === "undefined") return { mobile: false, inApp: false, ios: false };
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const mobile = ios || /Android/i.test(ua);
  // In-app browsers (Discord, WhatsApp, Instagram, Facebook, X, …) usually block AR.
  const inApp = /FBAN|FBAV|Instagram|Discord|WhatsApp|Line\/|Twitter|Snapchat|; wv\)/i.test(ua);
  return { mobile, inApp, ios };
}

// Full-screen viewer for "View in your room". AR needs a visible <model-viewer>:
// on Android it opens Google Scene Viewer, on iPhone Apple Quick Look (USDZ is
// generated in the browser when the model has none). Laptops get a QR code.
function ArView() {
  const params = useSearchParams();
  const id = params.get("id");
  const [rec, setRec] = useState<ModelRecord | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [support, setSupport] = useState<Support>("checking");
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const mv = useRef<MV>(null);
  const env = environment();

  useEffect(() => {
    if (!id) { setErr("No model selected."); return; }
    api<{ models: ModelRecord[] }>(`/api/models?id=${encodeURIComponent(id)}`)
      .then((r) => { const m = r.models.find((x) => x.id === id); if (m?.glb) setRec(m); else setErr("This model isn't available."); })
      .catch(() => setErr("Couldn't load the model."));
  }, [id]);

  // Ask the viewer whether AR can start; it only knows once it has upgraded, so poll.
  useEffect(() => {
    if (!rec) return;
    // Laptops and desktops never support AR: show the QR code straight away.
    if (!environment().mobile) { setSupport("no"); return; }
    let n = 0;
    const t = setInterval(() => {
      n++;
      const can = mv.current?.canActivateAR;
      if (can) { setSupport("yes"); clearInterval(t); }
      else if (n > 40) { setSupport("no"); clearInterval(t); }
    }, 500);
    const el = mv.current;
    const onStatus = (e: Event) => {
      const s = (e as CustomEvent<{ status: string }>).detail?.status;
      if (s === "failed") setStatus("AR couldn't start on this device. Try Chrome on Android or Safari on iPhone.");
    };
    el?.addEventListener("ar-status", onStatus);
    return () => { clearInterval(t); el?.removeEventListener("ar-status", onStatus); };
  }, [rec]);

  useEffect(() => {
    if (support === "no" && !env.mobile) QRCode.toDataURL(window.location.href, { margin: 1, width: 360, color: { dark: "#0b0b10", light: "#ffffff" } }).then(setQr).catch(() => {});
  }, [support, env.mobile]);

  if (err) return (
    <main className="wrap" style={{ paddingTop: 60, textAlign: "center" }}>
      <h1 className="display" style={{ fontSize: 34 }}>{err}</h1>
      <Link href="/" className="btn">← Back to Showroom</Link>
    </main>
  );

  return (
    <main className="wrap" style={{ paddingTop: 20, paddingBottom: 20 }}>
      <div className="ar-head">
        <div>
          <div className="eyebrow">View in your room</div>
          <h1 className="display" style={{ fontSize: "clamp(26px, 4vw, 40px)", margin: "4px 0 0", lineHeight: 1.05 }}>{rec?.title ?? "Loading…"}</h1>
        </div>
        <Link href="/" className="btn btn-sm">← Showroom</Link>
      </div>

      <div className="ar-stage">
        {rec && createElement("model-viewer", {
          ref: (el: MV | null) => { mv.current = el; enableAr(el); }, src: rec.glb, "ios-src": rec.usdz, alt: rec.title,
          ar: "", "ar-modes": "scene-viewer webxr quick-look", "ar-scale": "auto", "ar-placement": "floor",
          "camera-controls": "", "auto-rotate": "", "shadow-intensity": "1", exposure: "1.05", "environment-image": "neutral",
          "touch-action": "pan-y", style: { width: "100%", height: "100%" },
        },
          createElement("button", { slot: "ar-button", className: "btn btn-accent btn-lg ar-go" }, "▶ Place it in your room"),
        )}
      </div>

      <div className="ar-help card">
        {support === "checking" && <p className="muted" style={{ margin: 0 }}><span className="spin" style={{ width: 12, height: 12 }} /> Checking whether this device supports AR…</p>}
        {support === "yes" && (
          <p style={{ margin: 0 }}><b>Tap “Place it in your room”</b>, point your camera at the floor or a table, and the product appears at real size. Drag to move it, pinch to rotate.
            {env.inApp && <> <span className="faint">If nothing happens, open this page in {env.ios ? "Safari" : "Chrome"} (⋯ → “Open in browser”).</span></>}</p>
        )}
        {support === "no" && env.mobile && env.inApp && (
          <p style={{ margin: 0 }}><b>This in-app browser blocks AR.</b> Open this page in {env.ios ? "Safari" : "Chrome"} (tap ⋯ → “Open in browser”) and try again.</p>
        )}
        {support === "no" && env.mobile && !env.inApp && (
          <p style={{ margin: 0 }}><b>AR isn’t available in this browser.</b> On Android use Chrome with Google Play Services for AR; on iPhone use Safari. You can still drag to spin the model above.</p>
        )}
        {support === "no" && !env.mobile && (
          <div className="ar-qr">
            {qr && /* eslint-disable-next-line @next/next/no-img-element */ <img src={qr} alt="QR code to open this page on your phone" />}
            <p style={{ margin: 0 }}><b>Scan with your phone</b> to place this product in your room with AR. Works in Chrome on Android and Safari on iPhone.</p>
          </div>
        )}
        {status && <p style={{ margin: "8px 0 0", color: "#ff9a6b" }}>{status}</p>}
      </div>
    </main>
  );
}
