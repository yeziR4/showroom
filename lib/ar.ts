"use client";
// <model-viewer> decides whether AR is available when `ar` is set. React sets it
// before the element has its model, and model-viewer doesn't re-check, so the AR
// button stayed hidden on real phones. Re-apply `ar` once the element is defined
// and again after every model load so the check runs with the model in place.
type MV = HTMLElement & { ar?: boolean };

export function enableAr(el: HTMLElement | null) {
  if (!el || (el as unknown as { __arFixed?: boolean }).__arFixed) return;
  (el as unknown as { __arFixed?: boolean }).__arFixed = true;
  const mv = el as MV;
  const kick = () => { mv.ar = false; queueMicrotask(() => { mv.ar = true; }); };
  customElements.whenDefined("model-viewer").then(kick).catch(() => {});
  el.addEventListener("load", kick);
}
