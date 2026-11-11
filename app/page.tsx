import Link from "next/link";
import LiveBuilder from "@/components/LiveBuilder";
import ProductViewer from "@/components/ProductViewer";
import { listRecords } from "@/lib/models";

export const dynamic = "force-dynamic";

const NEXT = [
  { name: "View in your room", what: "Customers place the product in their space with their phone's AR.", href: null },
  { name: "3D video ads", what: "Turn the model into a TikTok, Reels or YouTube ad with camera moves and music.", href: "/studio/ad" },
  { name: "Colourways", what: "Lux3D repaints the model in new colours and materials — no new photoshoot.", href: "/studio" },
  { name: "On your store", what: "Push the model to Shopify, or embed it on any site with one line of HTML.", href: "/studio" },
];

export default async function Home() {
  const all = await listRecords((r) => r.status === "succeeded" && !!r.glb && r.kind === "product");
  const examples = all.filter((m) => m.image);

  return (
    <main>
      <section className="wrap" style={{ paddingTop: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 24, flexWrap: "wrap" }}>
        <div style={{ maxWidth: 760 }}>
          <span className="pill pill-accent">Powered by Aholo Lux3D</span>
          <h1 className="display" style={{ fontSize: "clamp(36px, 5vw, 60px)", lineHeight: 1.02, margin: "14px 0 0" }}>
            One product photo.<br />A real 3D model in <em style={{ color: "var(--accent)" }}>about a minute.</em>
          </h1>
        </div>
          <p className="muted" style={{ fontSize: 16, maxWidth: 400, margin: 0 }}>
            Drop in a photo of something you sell. Watch Lux3D build it in 3D, then spin it, place it in your room with AR
            and turn it into a video ad.
          </p>
        </div>

        <div style={{ marginTop: 24 }}>
          <LiveBuilder examples={examples} />
        </div>
      </section>

      <section className="wrap" style={{ marginTop: 72 }}>
        <div className="eyebrow">After the model</div>
        <h2 className="display" style={{ fontSize: 36, margin: "8px 0 18px" }}>What sellers do with it</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
          {NEXT.map((t) => {
            const inner = (
              <div className="card" style={{ padding: 18, height: "100%" }}>
                <div style={{ fontWeight: 700 }}>{t.name}{t.href && " →"}</div>
                <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>{t.what}</div>
              </div>
            );
            return t.href ? <Link key={t.name} href={t.href}>{inner}</Link> : <div key={t.name}>{inner}</div>;
          })}
        </div>
      </section>

      {all.length > 0 && (
        <section className="wrap" style={{ marginTop: 72 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div className="eyebrow">The 3D mall</div>
              <h2 className="display" style={{ fontSize: 36, margin: "8px 0 4px" }}>Real store products, rebuilt by Lux3D</h2>
              <p className="muted" style={{ margin: "0 0 18px" }}>Every model below was generated from the store’s own product photo.</p>
            </div>
            <Link href="/explore" className="btn">Explore stores →</Link>
          </div>
          <div className="grid">
            {all.slice(0, 8).map((m) => (
              <Link key={m.id} href={m.domain && m.domain !== "demo" ? `/store/${encodeURIComponent(m.domain)}` : "/explore"} className="card" style={{ overflow: "hidden" }}>
                <div style={{ aspectRatio: "1/1", background: "var(--bg-2)", position: "relative" }}>
                  <ProductViewer src={m.glb!} alt={m.title} poster={m.image} ar={false} />
                  <span className="pill" style={{ position: "absolute", left: 10, top: 10 }}>{m.example ? "Example" : "Built live"}</span>
                </div>
                <div style={{ padding: 14 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{m.title}</div>
                  <div className="faint" style={{ fontSize: 13 }}>{m.domain === "demo" ? "Lux3D sample" : m.domain?.replace(/^www\./, "")}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
