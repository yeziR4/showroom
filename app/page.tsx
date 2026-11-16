import Link from "next/link";
import LiveBuilder from "@/components/LiveBuilder";
import Showcase from "@/components/Showcase";
import Reveal from "@/components/Reveal";
import { isShowcased, listRecords } from "@/lib/models";

export const dynamic = "force-dynamic";

const STORES = ["Allbirds", "Fellow", "Kith", "Great Jones", "Burrow", "Ember", "Loop", "Native", "Misen", "Brooklinen", "Parachute", "Ridge", "MVMT", "Ugmonk", "Death Wish Coffee"];

// Products the hero cycles through first (colourful, clean results); the rest follow.
const HERO_FIRST = [
  "photo/f832387205473653", "kith.com/jor384665-105", "photo/dd43476d772aa6fd", "www.greatjonesgoods.com/holy-sheet-rainbow",
  "www.burrow.com/dunes-teak-ottoman-charcoal", "allbirds.com/womens-wool-runner-nz-shadow-blue-natural-white-sole",
  "www.greatjonesgoods.com/saucy-1", "www.fellowproducts.com/corvo-ekg-electric-kettle-body",
];

const STEPS = [
  { n: "01", t: "Drop a photo", d: "The product photo you already have. One object, plain background — no 3D skills, no photoshoot." },
  { n: "02", t: "Lux3D builds it", d: "Aholo Lux3D turns it into a textured 3D model with real materials — about a minute, watched live." },
  { n: "03", t: "Sell in 3D", d: "Spin it on your product page, place it in a room with AR, or turn it into a video ad." },
];

const FEATURES = [
  { t: "View in your room", d: "Shoppers place the product in their space with their phone's AR — at real size.", href: null, icon: "ar" },
  { t: "3D video ads", d: "Drop, orbit, reveal. Export for TikTok, Reels or YouTube with price and call to action.", href: "/studio/ad", icon: "film" },
  { t: "Colourways", d: "Lux3D repaints the model in new colours and materials. No new photoshoot.", href: "/studio", icon: "swatch" },
  { t: "On your store", d: "Push the model to Shopify product pages, or embed it anywhere with one line of HTML.", href: "/studio", icon: "store" },
];

function Icon({ name }: { name: string }) {
  const p = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "ar") return <svg {...p}><path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" /><path d="M4 7.5 12 12l8-4.5M12 12v9" /></svg>;
  if (name === "film") return <svg {...p}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m10 9 5 3-5 3V9Z" /></svg>;
  if (name === "swatch") return <svg {...p}><circle cx="8" cy="9" r="4" /><circle cx="16" cy="9" r="4" /><circle cx="12" cy="15.5" r="4" /></svg>;
  return <svg {...p}><path d="M4 9h16l-1.5-5h-13L4 9Z" /><path d="M5 9v10h14V9M9 19v-5h6v5" /></svg>;
}

export default async function Home() {
  const showcased = await listRecords(isShowcased);
  showcased.sort((a, b) => Number(!!a.example) - Number(!!b.example) || b.createdAt - a.createdAt);
  const examples = showcased.filter((m) => m.kind === "product" && m.image);
  const heroModels = [
    ...HERO_FIRST.map((id) => showcased.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m),
    ...showcased.filter((m) => !HERO_FIRST.includes(m.id) && m.image),
  ];

  const intro = (
    <>
      <div className="hero-badges">
        <span className="pill pill-accent">Powered by Aholo Lux3D</span>
        <span className="pill">For online sellers</span>
      </div>
      <h1 className="display hero-title">Any product photo.<br />A real 3D model in <em className="grad-text">about a minute.</em></h1>
      <p className="hero-sub">Drop in a photo of something you sell and watch Lux3D build it in 3D — then spin it, place it in your room and turn it into a video ad.</p>
    </>
  );

  return (
    <main>
      <section className="wrap">
        <LiveBuilder examples={examples} heroModels={heroModels} intro={intro} />
      </section>

      <section className="marquee" aria-label="Stores in the 3D mall">
        <div className="marquee-track">
          {[...STORES, ...STORES].map((s, i) => <span key={i}>{s}<i>✦</i></span>)}
        </div>
      </section>

      <section className="wrap" style={{ marginTop: 96 }}>
        <Reveal><div className="eyebrow">How it works</div>
          <h2 className="display section-title">Photo in. <em className="grad-text">3D out.</em></h2></Reveal>
        <div className="steps-row">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 120} className="step-card card">
              <div className="step-n grad-text display">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="muted">{s.d}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal><Showcase initial={showcased.slice(0, 12)} total={showcased.length} /></Reveal>

      <section className="wrap" style={{ marginTop: 120 }}>
        <Reveal><div className="eyebrow">After the model</div>
          <h2 className="display section-title">One model. <em className="grad-text">Everywhere you sell.</em></h2></Reveal>
        <div className="bento">
          {FEATURES.map((f, i) => {
            const inner = (
              <>
                <div className="bento-icon"><Icon name={f.icon} /></div>
                <div className="bento-t">{f.t}{f.href && <span className="bento-arrow">→</span>}</div>
                <p className="muted">{f.d}</p>
              </>
            );
            return (
              <Reveal key={f.t} delay={i * 90} className="bento-cell">
                {f.href ? <Link href={f.href} className="card bento-card">{inner}</Link> : <div className="card bento-card">{inner}</div>}
              </Reveal>
            );
          })}
          <Reveal delay={360} className="bento-cell bento-wide">
            <Link href="/explore" className="card bento-card bento-mall">
              <div>
                <div className="eyebrow">For shoppers</div>
                <div className="bento-t" style={{ fontSize: 26 }} >The 3D mall<span className="bento-arrow">→</span></div>
                <p className="muted">Search 15 real Shopify stores — “kettle”, “sneakers” — and walk any store as a 3D showroom.</p>
              </div>
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="wrap" style={{ marginTop: 120 }}>
        <Reveal className="cta-band">
          <h2 className="display" style={{ fontSize: "clamp(32px, 4.4vw, 56px)", lineHeight: 1.02, margin: 0 }}>Your products, <em className="grad-text">in 3D</em> — today.</h2>
          <p className="muted" style={{ fontSize: 17, margin: "14px 0 26px" }}>One photo. About a minute. About one Lux3D credit.</p>
          <Link href="/#build" className="btn btn-accent btn-lg">Build your first model</Link>
        </Reveal>
      </section>
    </main>
  );
}
