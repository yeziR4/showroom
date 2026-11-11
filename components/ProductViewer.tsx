"use client";
import { createElement } from "react";

// Thin wrapper around Google's <model-viewer> (loaded from CDN in the layout).
// Gives orbit controls, auto-rotate and AR on phones: Scene Viewer on Android,
// Quick Look on iOS (model-viewer converts GLB → USDZ on the fly if no usdz is given).
export default function ProductViewer({
  src, usdz, poster, alt, ar = true, autoRotate = true, lazy = false, style,
}: {
  src: string; usdz?: string; poster?: string; alt: string; ar?: boolean; autoRotate?: boolean; lazy?: boolean;
  style?: React.CSSProperties;
}) {
  return createElement(
    "model-viewer",
    {
      src,
      "ios-src": usdz,
      poster,
      alt,
      ar: ar ? "" : undefined,
      "ar-modes": "webxr scene-viewer quick-look",
      "ar-scale": "auto",
      "camera-controls": "",
      "auto-rotate": autoRotate ? "" : undefined,
      "auto-rotate-delay": 0,
      "rotation-per-second": "24deg",
      "shadow-intensity": "1",
      "shadow-softness": "0.8",
      exposure: "1.05",
      "environment-image": "neutral",
      "interaction-prompt": "none",
      loading: lazy ? "lazy" : "eager",
      style: { width: "100%", height: "100%", ...style },
    },
    ar
      ? createElement(
          "button",
          { slot: "ar-button", className: "btn btn-primary btn-sm", style: { position: "absolute", right: 12, bottom: 12 } },
          "View in your room",
        )
      : null,
  );
}
