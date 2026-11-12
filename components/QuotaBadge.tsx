"use client";
import { useEffect, useState } from "react";
import { withBase } from "@/lib/client";

// "N free 3D builds left today" — refreshes whenever `bump` changes.
export default function QuotaBadge({ bump = 0 }: { bump?: unknown }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    fetch(withBase("/api/quota")).then((r) => r.json()).then((q) => setLeft(q.remaining)).catch(() => {});
  }, [bump]);
  if (left === null) return null;
  return (
    <span className="pill" title="Each 3D build uses Lux3D credits, so the public demo has a daily limit.">
      {left > 0 ? `${left} free 3D build${left === 1 ? "" : "s"} left today` : "No free 3D builds left today"}
    </span>
  );
}
