// Showroom mark: an isometric cube whose right face is still made of particles
// drifting off its edge — a photo's pixels becoming a 3D object, the same idea
// as the live "scan".
const FACE_DOTS: { x: number; y: number; r: number }[] = [];
for (const a of [1 / 6, 1 / 2, 5 / 6]) for (const b of [1 / 6, 1 / 2, 5 / 6]) {
  FACE_DOTS.push({ x: 16 + 9.53 * a, y: 16 - 5.5 * a + 11 * b, r: 1.45 - 0.45 * a });
}
const DRIFT = [
  { x: 28.4, y: 12.4, r: 0.85 }, { x: 29.8, y: 17.2, r: 0.65 }, { x: 28.8, y: 22.4, r: 0.7 }, { x: 31.0, y: 14.4, r: 0.45 },
];

function Shapes({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}t`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffd27f" /><stop offset="1" stopColor="#ff8a3d" /></linearGradient>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff6a2b" /><stop offset="1" stopColor="#e3245f" /></linearGradient>
        <linearGradient id={`${id}d`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff7a35" /><stop offset="1" stopColor="#ff2d78" /></linearGradient>
      </defs>
      <g transform="translate(-1.6 0)">
        <path d="M16 5 L25.53 10.5 L16 16 L6.47 10.5 Z" fill={`url(#${id}t)`} />
        <path d="M6.47 10.5 L16 16 L16 27 L6.47 21.5 Z" fill={`url(#${id}l)`} />
        {FACE_DOTS.map((d, i) => <circle key={i} cx={d.x.toFixed(2)} cy={d.y.toFixed(2)} r={d.r.toFixed(2)} fill={`url(#${id}d)`} />)}
        {DRIFT.map((d, i) => <circle key={`d${i}`} cx={d.x} cy={d.y} r={d.r} fill="#ff2d78" opacity={0.75 - i * 0.12} />)}
      </g>
    </>
  );
}

export function LogoMark({ size = 30 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden><Shapes id="srl" /></svg>;
}

export default function Logo() {
  return (
    <span className="brand">
      <LogoMark />
      <span className="brand-word">Show<i>room</i></span>
    </span>
  );
}
