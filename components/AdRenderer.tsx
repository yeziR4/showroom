"use client";
import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { NormalizedModel } from "./Showroom3D";

export type Template = "spin" | "reveal" | "orbit" | "drop";

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));

// Drives camera, product and lights from a normalised time u ∈ [0,1].
function Director({ template, timeRef, glb }: { template: Template; timeRef: React.RefObject<number>; glb: string }) {
  const product = useRef<THREE.Group>(null);
  const key = useRef<THREE.SpotLight>(null);
  const { camera, size } = useThree();
  const target = new THREE.Vector3(0, 0.45, 0);

  useFrame(() => {
    const u = clamp(timeRef.current ?? 0);
    const p = product.current;
    if (!p) return;
    let r = 3, theta = 0.6, phi = 1.25, lift = 0, spin = u * Math.PI * 2, light = 70;

    if (template === "spin") {
      r = 3.1 - ease(u) * 0.7; theta = 0.5; phi = 1.22;
    } else if (template === "reveal") {
      const a = ease(clamp(u / 0.45));
      r = 1.3 + a * 1.9; theta = -0.4 + a * 0.9; phi = 1.45 - a * 0.25;
      light = 5 + a * 75; spin = u * Math.PI * 1.2;
    } else if (template === "orbit") {
      const a = ease(u);
      r = 2.9; theta = -1.6 + a * Math.PI * 1.1; phi = 1.5 - a * 0.45; spin = 0;
    } else if (template === "drop") {
      const t = clamp(u / 0.3);
      // Fall with two damped bounces, then a slow turn.
      const bounce = t < 1 ? Math.abs(Math.cos(t * Math.PI * 2.5)) * Math.pow(1 - t, 2) * 2.2 : 0;
      lift = bounce; r = 3; theta = 0.55; phi = 1.25;
      spin = clamp((u - 0.3) / 0.7) * Math.PI * 1.5;
      const squash = t < 1 && bounce < 0.05 ? 0.92 : 1;
      p.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    }

    // Pull the camera back for tall frames so the product fits the narrower width.
    const aspect = size.width / size.height;
    r *= aspect < 1 ? Math.min(2.1, 0.95 / aspect) : 1;

    p.position.y = lift;
    p.rotation.y = spin;
    camera.position.set(r * Math.sin(phi) * Math.sin(theta), target.y + r * Math.cos(phi), r * Math.sin(phi) * Math.cos(theta));
    camera.lookAt(target);
    if (key.current) key.current.intensity = light;
  });

  return (
    <>
      <ambientLight intensity={0.3} />
      <spotLight ref={key} position={[2.5, 5, 3]} angle={0.55} penumbra={0.9} intensity={70} castShadow />
      <pointLight position={[-3, 1.5, -2]} intensity={12} color="#ffd9b0" />
      <group ref={product}>
        <Suspense fallback={null}>
          <NormalizedModel url={glb} size={1.15} />
        </Suspense>
      </group>
      <ContactShadows position={[0, 0.001, 0]} opacity={0.45} scale={6} blur={2.2} far={2} />
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} position={[0, 4, -3]} scale={[8, 2, 1]} />
        <Lightformer form="rect" intensity={2} position={[-4, 1, 2]} rotation-y={Math.PI / 2} scale={[5, 2, 1]} />
        <Lightformer form="rect" intensity={2} position={[4, 1, 2]} rotation-y={-Math.PI / 2} scale={[5, 2, 1]} />
      </Environment>
    </>
  );
}

// Off-screen WebGL canvas at the exact output size. The ad studio composites
// its frames (plus text) onto a 2D canvas that is previewed and recorded.
export default function AdRenderer({
  glb, template, timeRef, width, height, onCanvas,
}: {
  glb: string; template: Template; timeRef: React.RefObject<number>; width: number; height: number;
  onCanvas: (c: HTMLCanvasElement) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const c = wrap.current?.querySelector("canvas");
    if (c) onCanvas(c);
  });
  return (
    <div ref={wrap} aria-hidden style={{ position: "fixed", left: 0, top: 0, width, height, opacity: 0, pointerEvents: "none", zIndex: -1 }}>
      <Canvas
        key={`${width}x${height}`}
        shadows
        dpr={1}
        gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true }}
        camera={{ fov: 32, position: [0, 1, 3] }}
        onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); onCanvas(gl.domElement); }}
        style={{ width, height }}
      >
        <Director template={template} timeRef={timeRef} glb={glb} />
      </Canvas>
    </div>
  );
}
