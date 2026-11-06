// Browser-only 3D scene. Loaded lazily after hydration by Hero.tsx.
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

// WebGL materials need literal colours; these mirror the brand tokens.
const GREEN = "#263B31";
const TERRA = "#C78E78";
const SAGE = "#A8B8A3";
const CREAM = "#F1EDE4";

function Bottle() {
  const profile = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    pts.push(new THREE.Vector2(0, 0));
    pts.push(new THREE.Vector2(0.62, 0));
    pts.push(new THREE.Vector2(0.7, 0.08));
    pts.push(new THREE.Vector2(0.72, 1.55));
    pts.push(new THREE.Vector2(0.62, 1.82));
    pts.push(new THREE.Vector2(0.3, 1.95));
    pts.push(new THREE.Vector2(0.26, 2.05));
    pts.push(new THREE.Vector2(0, 2.05));
    return pts;
  }, []);
  return (
    <group position={[0, -1.2, 0]}>
      <mesh castShadow>
        <latheGeometry args={[profile, 96]} />
        <meshPhysicalMaterial color={TERRA} roughness={0.1} transmission={0.5} thickness={0.9} clearcoat={1} clearcoatRoughness={0.06} ior={1.45} envMapIntensity={1.1} />
      </mesh>
      {/* inner serum */}
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.58, 0.58, 1.3, 64]} />
        <meshStandardMaterial color="#B5715A" roughness={0.3} transparent opacity={0.65} />
      </mesh>
      {/* label */}
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.728, 0.728, 0.62, 96, 1, true, -0.9, 1.8]} />
        <meshStandardMaterial color={CREAM} roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      {/* collar + dropper cap */}
      <mesh position={[0, 2.18, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 0.28, 48]} />
        <meshStandardMaterial color="#C9A86A" metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh position={[0, 2.62, 0]}>
        <capsuleGeometry args={[0.24, 0.5, 12, 32]} />
        <meshStandardMaterial color={GREEN} roughness={0.55} />
      </mesh>
    </group>
  );
}

function Leaf({ position, rotation, scale = 1 }: { position: [number, number, number]; rotation: [number, number, number]; scale?: number | undefined}) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(0.35, 0.3, 0.35, 0.9, 0, 1.4);
    s.bezierCurveTo(-0.35, 0.9, -0.35, 0.3, 0, 0);
    return s;
  }, []);
  return (
    <mesh position={position} rotation={rotation} scale={scale}>
      <extrudeGeometry args={[shape, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 }]} />
      <meshStandardMaterial color={SAGE} roughness={0.7} />
    </mesh>
  );
}

// Motion feel — tune here.
const IDLE_SPIN = 0.22; // rad/s
const MAX_TILT_X = 0.18; // rad, cursor-driven
const MAX_TILT_Y = 0.35;
const FOLLOW = 3.2; // damping rate
const FLOAT_AMP = 0.07;
const ENTRANCE_S = 1.1;

function Rig({ still }: { still: boolean }) {
  const g = useRef<THREE.Group>(null);
  const spin = useRef(0);
  const t0 = useRef<number | null>(null);
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const grp = g.current;
    if (!grp) return;
    if (t0.current === null) t0.current = state.clock.elapsedTime;
    // eased entrance (0→1)
    const k = still ? 1 : Math.min(1, (state.clock.elapsedTime - t0.current) / ENTRANCE_S);
    const e = 1 - Math.pow(1 - k, 3);
    grp.scale.setScalar(0.82 + 0.18 * e);
    if (still) return;
    spin.current += dt * IDLE_SPIN;
    const damp = 1 - Math.exp(-FOLLOW * dt);
    const tx = THREE.MathUtils.clamp(-state.pointer.y, -1, 1) * MAX_TILT_X;
    const ty = THREE.MathUtils.clamp(state.pointer.x, -1, 1) * MAX_TILT_Y;
    grp.rotation.x += (tx - grp.rotation.x) * damp;
    grp.rotation.y = spin.current + ty * e;
    grp.position.x += (state.pointer.x * 0.18 - grp.position.x) * damp;
    grp.position.y = (1 - e) * -0.7 + Math.sin(state.clock.elapsedTime * 0.8) * FLOAT_AMP;
    grp.rotation.z = Math.sin(state.clock.elapsedTime * 0.5) * 0.03;
    // camera: slow dolly-in on entrance, then subtle parallax
    const cam = state.camera;
    cam.position.z += (7.4 + (1 - e) * 1.8 - cam.position.z) * damp;
    cam.position.x += (state.pointer.x * 0.35 - cam.position.x) * damp * 0.5;
    cam.position.y += (0.5 + state.pointer.y * 0.2 - cam.position.y) * damp * 0.5;
    cam.lookAt(0, 0.1, 0);
  });
  return (
    <group ref={g}>
      <Bottle />
      <Leaf position={[-1.1, -1.25, 0.3]} rotation={[0, 0.3, 0.6]} scale={1.2} />
      <Leaf position={[1.0, -1.25, -0.2]} rotation={[0, -0.4, -0.5]} />
      <Leaf position={[-0.6, -1.25, -0.6]} rotation={[0.2, 0.8, 0.2]} scale={0.8} />
    </group>
  );
}

export default function HeroScene({ still }: { still: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const lowPower = typeof navigator !== "undefined" && (navigator.hardwareConcurrency ?? 8) <= 4;
  // Pause rendering when the hero scrolls out of view.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const o = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), { threshold: 0.01 });
    o.observe(el);
    return () => o.disconnect();
  }, []);
  return (
    <div ref={wrap} className="h-full w-full transition-opacity duration-700" style={{ opacity: ready ? 1 : 0 }} data-scene-ready={ready || undefined}>
      <Canvas
        dpr={lowPower ? [1, 1.25] : [1, 1.75]}
        frameloop={visible && !still ? "always" : "demand"}
        camera={{ position: [0, 0.5, 9.2], fov: 36 }}
        gl={{ antialias: !lowPower, alpha: true, powerPreference: "high-performance" }}
        onCreated={() => requestAnimationFrame(() => setReady(true))}
      >
        <ambientLight intensity={0.35} />
        <directionalLight position={[3, 5, 4]} intensity={1.8} />
        <directionalLight position={[-4, 2, -2]} intensity={0.7} color={TERRA} />
        <pointLight position={[0, 2, 3]} intensity={4} color="#FFF4E6" />
        <Environment resolution={128}>
          <Lightformer intensity={2.2} position={[0, 5, 2]} scale={[8, 3, 1]} />
          <Lightformer intensity={1.4} color="#FFE9D6" position={[-5, 1, 1]} rotation-y={Math.PI / 2} scale={[10, 2, 1]} />
          <Lightformer intensity={0.9} color={SAGE} position={[5, 0, -1]} rotation-y={-Math.PI / 2} scale={[10, 2, 1]} />
        </Environment>
        <Rig still={still} />
        <ContactShadows position={[0, -1.22, 0]} opacity={0.28} scale={6} blur={2.6} far={2} frames={1} />
      </Canvas>
    </div>
  );
}
