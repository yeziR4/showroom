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
        <meshStandardMaterial color={hover || active ? "#4a4a56" : "#34343f"} roughness={0.35} metalness={0.15} />
      </mesh>
      {/* glowing rim on top of the pedestal */}
      <mesh position={[0, 0.505, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.6, 0.66, 64]} />
        <meshBasicMaterial color="#ff6a2b" transparent opacity={hover || active ? 0.95 : 0.55} toneMapped={false} />
      </mesh>
      <group ref={spin} position={[0, 0.5, 0]} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <Suspense fallback={<mesh position={[0, 0.3, 0]}><boxGeometry args={[0.3, 0.3, 0.3]} /><meshStandardMaterial color="#ddd" wireframe /></mesh>}>
          <NormalizedModel url={item.glb} size={1.15} />
        </Suspense>
      </group>
      <pointLight position={[0, 2.6, 0.6]} intensity={hover || active ? 12 : 7} distance={4} color="#fff0e0" />
      <Html position={[0, 0.12, 0.78]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div style={{ background: "rgba(14,14,20,.78)", color: "#f5f2ec", border: "1px solid rgba(255,255,255,.12)", backdropFilter: "blur(8px)", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", boxShadow: "0 4px 14px rgba(0,0,0,.12)" }}>
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
      <color attach="background" args={["#08080c"]} />
      <fog attach="fog" args={["#08080c", 7, 18]} />
      <hemisphereLight args={["#fff1e2", "#2a2030", 1.2]} />
      <spotLight position={[3, 7, 4]} angle={0.6} penumbra={0.8} intensity={160} castShadow shadow-mapSize={[1024, 1024]} color="#fff6ea" />
      <directionalLight position={[-4, 3, -4]} intensity={2.5} color="#ffc9a8" />
      <directionalLight position={[4, 2, -3]} intensity={2} color="#a9cfff" />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#17171f" roughness={0.3} metalness={0.25} />
      </mesh>
      {/* back wall with a warm arch glow */}
      <mesh position={[0, 4, -6]} receiveShadow>
        <planeGeometry args={[60, 12]} />
        <meshStandardMaterial color="#0d0d13" roughness={1} />
      </mesh>
      {/* soft glow behind the pedestals: stacked translucent discs fake a radial gradient */}
      {Array.from({ length: 14 }, (_, i) => 4.2 - i * 0.26).map((r, i) => (
        <mesh key={i} position={[0, 2.0, -5.95 + i * 0.001]}>
          <circleGeometry args={[r, 64]} />
          <meshBasicMaterial color="#ff6a2b" transparent opacity={0.012} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
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
