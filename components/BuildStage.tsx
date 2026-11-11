"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { NormalizedModel } from "./Showroom3D";

// ---------------------------------------------------------------------------
// The "live build" stage: while Lux3D works, the product photo dissolves into
// a cloud of coloured particles, inflates into a 3D relief and gets scanned.
// When the real model arrives the particles burst away and the model lands.
// ---------------------------------------------------------------------------

type Cloud = { home: Float32Array; flat: Float32Array; scatter: Float32Array; color: Float32Array; count: number; height: number };

// Sample the photo into points. Background (transparent or near-white) is skipped.
// Depth is faked with an ellipsoid "pillow" over the object's silhouette, mirrored
// to the back so the cloud reads as a solid object when it turns.
async function sampleImage(src: string, maxSide = 150): Promise<Cloud> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
  const k = maxSide / Math.max(img.width, img.height);
  const w = Math.max(8, Math.round(img.width * k)), h = Math.max(8, Math.round(img.height * k));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, w, h);
  const px = g.getImageData(0, 0, w, h).data;

  const keep: number[] = [];
  let minX = w, maxX = 0, minY = h, maxY = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    const [r, gg, b, a] = [px[o], px[o + 1], px[o + 2], px[o + 3]];
    if (a < 40) continue;
    if (r > 236 && gg > 236 && b > 236) continue; // studio-white background
    keep.push(x, y);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  // Nothing detected (e.g. full-bleed lifestyle photo): use every pixel.
  if (keep.length < 200) {
    keep.length = 0; minX = 0; maxX = w - 1; minY = 0; maxY = h - 1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) keep.push(x, y);
  }

  const n = keep.length / 2;
  const count = n * 2;
  const home = new Float32Array(count * 3), flat = new Float32Array(count * 3), scatter = new Float32Array(count * 3), color = new Float32Array(count * 3);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const span = Math.max(maxX - minX, maxY - minY, 1);
  const scale = 1.9 / span;
  const rx = (maxX - minX) / 2 + 1, ry = (maxY - minY) / 2 + 1;
  const depth = 0.42 * (Math.min(rx, ry) / Math.max(rx, ry)) + 0.18;

  for (let i = 0; i < n; i++) {
    const x = keep[i * 2], y = keep[i * 2 + 1], o = (y * w + x) * 4;
    const X = (x - cx + (Math.random() - 0.5) * 0.9) * scale, Y = -(y - cy + (Math.random() - 0.5) * 0.9) * scale;
    const e = 1 - ((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2;
    const lum = (px[o] * 0.3 + px[o + 1] * 0.59 + px[o + 2] * 0.11) / 255;
    const Z = Math.sqrt(Math.max(0, e)) * depth + (lum - 0.5) * 0.04;
    for (const side of [0, 1]) {
      const j = (i * 2 + side) * 3;
      home[j] = X; home[j + 1] = Y; home[j + 2] = side ? -Z : Z;
      flat[j] = X; flat[j + 1] = Y; flat[j + 2] = side ? -0.002 : 0;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), R = 2.2 + Math.random() * 2.5;
      scatter[j] = R * Math.sin(ph) * Math.cos(th); scatter[j + 1] = R * Math.cos(ph); scatter[j + 2] = R * Math.sin(ph) * Math.sin(th);
      const dim = side ? 0.7 : 1.3; // a little brighter than the photo so it glows on the dark stage
      color[j] = Math.min(1, (px[o] / 255) * dim); color[j + 1] = Math.min(1, (px[o + 1] / 255) * dim); color[j + 2] = Math.min(1, (px[o + 2] / 255) * dim);
    }
  }
  return { home, flat, scatter, color, count, height: (maxY - minY) * scale };
}

function dotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.35, "rgba(255,255,255,.85)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const easeInOut = (x: number) => { x = Math.min(1, Math.max(0, x)); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOutBack = (x: number) => { const c1 = 1.70158, c3 = c1 + 1; x = Math.min(1, Math.max(0, x)); return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

const ACCENT = new THREE.Color("#ff6a2b");

function ParticleSculpture({ cloud, revealAt, speed }: { cloud: Cloud; revealAt: number | null; speed: number }) {
  const pts = useRef<THREE.Points>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const t0 = useRef<number | null>(null);
  const tex = useMemo(() => dotTexture(), []);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(cloud.scatter.slice(), 3));
    g.setAttribute("color", new THREE.BufferAttribute(cloud.color.slice(), 3));
    return g;
  }, [cloud]);
  const burst = useMemo(() => {
    const v = new Float32Array(cloud.count * 3);
    for (let i = 0; i < cloud.count; i++) {
      const x = cloud.home[i * 3], y = cloud.home[i * 3 + 1], z = cloud.home[i * 3 + 2];
      const l = Math.hypot(x, y, z) || 1;
      const s = 2.5 + Math.random() * 3.5;
      v[i * 3] = (x / l) * s; v[i * 3 + 1] = (y / l) * s + Math.random(); v[i * 3 + 2] = (z / l) * s;
    }
    return v;
  }, [cloud]);

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (t0.current === null) t0.current = now;
    const t = (now - t0.current) * speed;
    const p = pts.current; if (!p) return;
    const pos = geo.attributes.position.array as Float32Array;
    const col = geo.attributes.color.array as Float32Array;
    const n = cloud.count;

    const assemble = easeInOut(t / 1.6);          // scatter → flat photo
    const inflate = easeInOut((t - 1.9) / 2.2);   // flat photo → 3D relief
    const burstT = revealAt !== null ? Math.max(0, now - revealAt) : 0;
    const b = revealAt !== null ? easeOut(burstT / 0.9) : 0;
    const half = cloud.height / 2 + 0.15;
    const scanY = Math.sin(t * 1.3) * half;       // laser ring height
    const scanOn = Math.min(1, Math.max(0, (t - 3.5) / 1));

    for (let i = 0; i < n; i++) {
      const j = i * 3;
      const hx = cloud.flat[j] + (cloud.home[j] - cloud.flat[j]) * inflate;
      const hy = cloud.flat[j + 1] + (cloud.home[j + 1] - cloud.flat[j + 1]) * inflate;
      const hz = cloud.flat[j + 2] + (cloud.home[j + 2] - cloud.flat[j + 2]) * inflate;
      // gentle breathing shimmer once assembled
      const wob = 0.012 * inflate * Math.sin(t * 3 + i * 0.37);
      let x = cloud.scatter[j] + (hx - cloud.scatter[j]) * assemble;
      let y = cloud.scatter[j + 1] + (hy - cloud.scatter[j + 1]) * assemble + wob;
      let z = cloud.scatter[j + 2] + (hz - cloud.scatter[j + 2]) * assemble;
      if (b > 0) { x += burst[j] * b; y += burst[j + 1] * b - 1.5 * b * b; z += burst[j + 2] * b; }
      pos[j] = x; pos[j + 1] = y; pos[j + 2] = z;

      // particles near the scan line glow orange
      const d = Math.abs(hy - scanY);
      const glow = scanOn * Math.max(0, 1 - d / 0.07);
      col[j] = cloud.color[j] + (ACCENT.r - cloud.color[j]) * glow;
      col[j + 1] = cloud.color[j + 1] + (ACCENT.g - cloud.color[j + 1]) * glow;
      col[j + 2] = cloud.color[j + 2] + (ACCENT.b - cloud.color[j + 2]) * glow;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;

    // turntable: sway while inflating, then a slow full rotation
    p.rotation.y = inflate < 1 ? Math.sin(t * 0.8) * 0.5 * inflate : 0.5 * Math.sin(0.8 * 4.1) + (t - 4.1) * 0.45;
    (p.material as THREE.PointsMaterial).opacity = 1 - b;

    for (const [r, off] of [[ring.current, 0], [ring2.current, Math.PI]] as const) {
      if (!r) continue;
      r.position.y = Math.sin(t * 1.3 + off) * half;
      r.rotation.x = Math.PI / 2;
      const m = r.material as THREE.MeshBasicMaterial;
      m.opacity = (off ? 0.35 : 0.9) * scanOn * (1 - b);
    }
  });

  return (
    <group>
      <points ref={pts} geometry={geo}>
        <pointsMaterial size={0.033} map={tex} vertexColors transparent alphaTest={0.25} depthWrite sizeAttenuation toneMapped={false} />
      </points>
      <mesh ref={ring}>
        <torusGeometry args={[1.25, 0.006, 8, 160]} />
        <meshBasicMaterial color="#ff7a3d" transparent opacity={0} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={ring2}>
        <torusGeometry args={[1.4, 0.004, 8, 160]} />
        <meshBasicMaterial color="#7fd3ff" transparent opacity={0} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function LandedModel({ glb, revealAt, onLoaded }: { glb: string; revealAt: number | null; onLoaded: () => void }) {
  const g = useRef<THREE.Group>(null);
  // Rendering this component means Suspense has finished loading the GLB.
  useEffect(() => { onLoaded(); }, [onLoaded]);
  useFrame((state, dt) => {
    if (!g.current) return;
    if (revealAt === null) { g.current.scale.setScalar(0.0001); return; }
    const t = state.clock.elapsedTime - revealAt - 0.35;
    const s = t <= 0 ? 0.0001 : 0.6 + 0.4 * easeOutBack(t / 0.9);
    g.current.scale.setScalar(s);
    g.current.rotation.y += dt * (t < 1.2 ? 2.2 * (1 - t / 1.2) + 0.25 : 0.25);
  });
  return (
    <group ref={g} position={[0, -0.62, 0]} scale={0.0001}>
      <NormalizedModel url={glb} size={1.7} />
    </group>
  );
}

// Pull the camera back on tall/narrow screens so the object always fits.
function CameraFit() {
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / size.height;
    camera.position.set(0, 0.15, 3.6 * Math.max(1, 1.4 / aspect));
    camera.lookAt(0, 0, 0);
  }, [camera, size.width, size.height]);
  return null;
}

function Floor({ on }: { on: boolean }) {
  return on ? <ContactShadows position={[0, -0.62, 0]} opacity={0.55} scale={6} blur={2.4} far={2} color="#000" /> : null;
}

export type BuildPhase = "uploading" | "building" | "done" | "failed";

export default function BuildStage({
  image, glb, phase, speed = 1, onRevealed,
}: {
  image: string; glb?: string; phase: BuildPhase; speed?: number; onRevealed?: () => void;
}) {
  const [cloud, setCloud] = useState<Cloud | null>(null);
  const [revealAt, setRevealAt] = useState<number | null>(null);
  const clockRef = useRef<THREE.Clock | null>(null);

  useEffect(() => {
    let alive = true;
    setCloud(null); setRevealAt(null);
    sampleImage(image).then((c) => alive && setCloud(c)).catch(() => {});
    return () => { alive = false; };
  }, [image]);

  const [modelReady, setModelReady] = useState(false);
  useEffect(() => { setModelReady(false); }, [glb]);

  // Burst once the model file has actually loaded, so it lands the moment the particles clear.
  useEffect(() => {
    if (phase !== "done" || !glb || !modelReady || revealAt !== null || !clockRef.current) return;
    const id = setTimeout(() => {
      if (clockRef.current) setRevealAt(clockRef.current.elapsedTime);
      setTimeout(() => onRevealed?.(), 1300);
    }, 300);
    return () => clearTimeout(id);
  }, [phase, glb, modelReady, revealAt, onRevealed]);

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.15, 3.6], fov: 38 }}
      onCreated={({ clock }) => { clockRef.current = clock; }}
      gl={{ antialias: true, alpha: true }}
    >
      {cloud && <ParticleSculpture cloud={cloud} revealAt={revealAt} speed={speed} />}
      {glb && phase === "done" && (
        <Suspense fallback={null}>
          <LandedModel glb={glb} revealAt={revealAt} onLoaded={() => setModelReady(true)} />
        </Suspense>
      )}
      <CameraFit />
      <Floor on={revealAt !== null} />
      <hemisphereLight args={["#fff3e6", "#2a2230", 0.9]} />
      <spotLight position={[2.5, 5, 3]} angle={0.55} penumbra={0.9} intensity={70} />
      {/* rim lights so dark products separate from the dark stage */}
      <directionalLight position={[-3, 2.5, -3]} intensity={2.2} color="#ffd2b0" />
      <directionalLight position={[3, 1.5, -2.5]} intensity={1.6} color="#a9dcff" />
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} position={[0, 4, -3]} scale={[8, 2, 1]} />
        <Lightformer form="rect" intensity={2} position={[-4, 1, 2]} rotation-y={Math.PI / 2} scale={[5, 2, 1]} />
        <Lightformer form="rect" intensity={2} position={[4, 1, 2]} rotation-y={-Math.PI / 2} scale={[5, 2, 1]} />
      </Environment>
      {revealAt !== null && <OrbitControls enablePan={false} minDistance={2} maxDistance={7} target={[0, 0, 0]} />}
    </Canvas>
  );
}
