"use client";
import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Html, Lightformer, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

export type ShowroomItem = { id: string; glb: string; title: string; price?: string };

// Loads a GLB and scales it so its largest side is `size` units, resting on y=0.
export function NormalizedModel({ url, size = 1 }: { url: string; size?: number }) {
  const { scene } = useGLTF(url);
  const obj = useMemo(() => {
    const s = scene.clone(true);
    const box = new THREE.Box3().setFromObject(s);
    const dim = box.getSize(new THREE.Vector3());
    const k = size / Math.max(dim.x, dim.y, dim.z || 1);
    s.scale.setScalar(k);
    const b2 = new THREE.Box3().setFromObject(s);
    const c = b2.getCenter(new THREE.Vector3());
    s.position.set(-c.x, -b2.min.y, -c.z);
    s.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return s;
  }, [scene, size]);
  return <primitive object={obj} />;
}

function Pedestal({ item, position, onSelect, active }: { item: ShowroomItem; position: [number, number, number]; onSelect: () => void; active: boolean }) {
  const spin = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  useFrame((_, dt) => { if (spin.current) spin.current.rotation.y += dt * (hover || active ? 0.9 : 0.25); });
  return (
    <group position={position}>
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = ""; }}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <cylinderGeometry args={[0.66, 0.7, 0.5, 64]} />
        <meshStandardMaterial color={hover || active ? "#ffffff" : "#f7f2ea"} roughness={0.25} />
      </mesh>
      <group ref={spin} position={[0, 0.5, 0]} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <Suspense fallback={<mesh position={[0, 0.3, 0]}><boxGeometry args={[0.3, 0.3, 0.3]} /><meshStandardMaterial color="#ddd" wireframe /></mesh>}>
          <NormalizedModel url={item.glb} size={1.15} />
        </Suspense>
      </group>
      <pointLight position={[0, 2.6, 0.6]} intensity={hover || active ? 9 : 5} distance={4} color="#fff4e6" />
      <Html position={[0, 0.12, 0.78]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div style={{ background: "rgba(255,255,255,.92)", color: "#17140f", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", boxShadow: "0 4px 14px rgba(0,0,0,.12)" }}>
          {item.title}{item.price ? ` · $${Number(item.price).toFixed(0)}` : ""}
        </div>
      </Html>
    </group>
  );
}

export default function Showroom3D({ items, onSelect, activeId }: { items: ShowroomItem[]; onSelect: (id: string) => void; activeId?: string }) {
  // Lay pedestals out on a gentle arc, in rows of up to 5.
  const positions = useMemo(() => items.map((_, i) => {
    const row = Math.floor(i / 5), col = i % 5, inRow = Math.min(5, items.length - row * 5);
    const x = (col - (inRow - 1) / 2) * 1.9;
    const z = -row * 2.2 - Math.abs(x) * 0.18;
    return [x, 0, z] as [number, number, number];
  }), [items]);
  const width = Math.min(items.length, 5);

  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 1.9, 2.6 + width * 0.9], fov: 40 }} gl={{ preserveDrawingBuffer: true }}>
      <color attach="background" args={["#f6efe4"]} />
      <fog attach="fog" args={["#f6efe4", 8, 20]} />
      <hemisphereLight args={["#fff8ee", "#e9dcc8", 1.1]} />
      <spotLight position={[3, 7, 4]} angle={0.55} penumbra={0.8} intensity={90} castShadow shadow-mapSize={[1024, 1024]} color="#fff6ea" />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#f1e9dc" roughness={0.8} />
      </mesh>
      {/* back wall with a warm arch glow */}
      <mesh position={[0, 4, -6]} receiveShadow>
        <planeGeometry args={[60, 12]} />
        <meshStandardMaterial color="#efe4d3" roughness={1} />
      </mesh>
      <mesh position={[0, 2.2, -5.95]}>
        <circleGeometry args={[2.6, 64]} />
        <meshBasicMaterial color="#ffd7b0" transparent opacity={0.45} />
      </mesh>
      {items.map((it, i) => (
        <Pedestal key={it.id} item={it} position={positions[i]} onSelect={() => onSelect(it.id)} active={activeId === it.id} />
      ))}
      <ContactShadows position={[0, 0.001, 0]} opacity={0.35} scale={20} blur={2.4} far={4} />
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} position={[0, 5, -3]} scale={[10, 2, 1]} />
        <Lightformer form="rect" intensity={2} position={[-5, 2, 2]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer form="rect" intensity={2} position={[5, 2, 2]} rotation-y={-Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer form="circle" intensity={1.5} position={[0, 1, 6]} scale={3} />
      </Environment>
      <OrbitControls makeDefault target={[0, 0.8, -Math.floor((items.length - 1) / 5) * 1.1]} minDistance={2} maxDistance={16} maxPolarAngle={Math.PI / 2.1} enableDamping />
    </Canvas>
  );
}
