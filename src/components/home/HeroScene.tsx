// Browser-only 3D scene. Loaded lazily after hydration by Hero.tsx.
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
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
        <meshPhysicalMaterial color={TERRA} roughness={0.12} transmission={0.55} thickness={0.8} clearcoat={1} clearcoatRoughness={0.08} ior={1.45} />
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

function Leaf({ position, rotation, scale = 1 }: { position: [number, number, number]; rotation: [number, number, number]; scale?: number }) {
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

function Rig({ still }: { still: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    if (!g.current || still) return;
    g.current.rotation.y += dt * 0.25;
    const tx = state.pointer.x * 0.25;
    const ty = state.pointer.y * 0.12;
    g.current.rotation.x += (ty - g.current.rotation.x) * 0.05;
    g.current.position.x += (tx - g.current.position.x) * 0.05;
    g.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.06;
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
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0.4, 5.2], fov: 38 }} gl={{ antialias: true, alpha: true }} shadows>
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 4]} intensity={2.2} castShadow />
      <directionalLight position={[-4, 2, -2]} intensity={0.8} color={TERRA} />
      <pointLight position={[0, 2, 3]} intensity={6} color="#FFF4E6" />
      <Rig still={still} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.22, 0]} receiveShadow>
        <circleGeometry args={[2.4, 64]} />
        <shadowMaterial opacity={0.12} />
      </mesh>
    </Canvas>
  );
}
