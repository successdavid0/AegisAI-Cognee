"use client";
import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, Sparkles } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

/* AEGIS 3D hero — a smooth, rotating "entity graph" constellation with a
   glowing core and cinematic bloom. On-brand for Adaptive *Entity Graph*
   Intelligence: nodes = scam entities, red = flagged threats, lines =
   relationships, core = the living memory graph. */

const NODE_COUNT = 46;
const RADIUS = 2.4;
const VIOLET = "#7c5cff";
const CYAN = "#22d3ee";
const RED = "#ff4d5e";

type NodeSpec = { pos: THREE.Vector3; color: string; size: number; threat: boolean };

function buildGraph(): { nodes: NodeSpec[]; edges: [THREE.Vector3, THREE.Vector3][] } {
  const nodes: NodeSpec[] = [];
  const golden = Math.PI * (1 + Math.sqrt(5));
  for (let i = 0; i < NODE_COUNT; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / NODE_COUNT);
    const theta = golden * i;
    const jitter = 0.92 + Math.random() * 0.16;
    const pos = new THREE.Vector3(
      Math.cos(theta) * Math.sin(phi),
      Math.cos(phi),
      Math.sin(theta) * Math.sin(phi),
    ).multiplyScalar(RADIUS * jitter);
    const threat = i % 7 === 0;
    const color = threat ? RED : i % 3 === 0 ? CYAN : VIOLET;
    nodes.push({ pos, color, size: threat ? 0.08 : 0.045, threat });
  }

  const edges: [THREE.Vector3, THREE.Vector3][] = [];
  const seen = new Set<string>();
  nodes.forEach((n, i) => {
    const near = nodes
      .map((m, j) => ({ j, d: n.pos.distanceTo(m.pos) }))
      .filter((x) => x.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    near.forEach(({ j }) => {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) return;
      seen.add(key);
      edges.push([n.pos, nodes[j].pos]);
    });
  });
  return { nodes, edges };
}

function Constellation() {
  const bob = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const { nodes, edges } = useMemo(() => buildGraph(), []);

  useFrame((state, delta) => {
    // Smooth, frame-rate-independent motion.
    const t = state.clock.elapsedTime;
    if (spin.current) spin.current.rotation.y += delta * 0.08;
    if (bob.current) bob.current.position.y = Math.sin(t * 0.5) * 0.12;
    if (tilt.current) {
      // Eased parallax toward the pointer — damped for a fluid feel.
      const damp = 1 - Math.pow(0.001, delta);
      tilt.current.rotation.x = THREE.MathUtils.lerp(tilt.current.rotation.x, state.pointer.y * 0.22, damp);
      tilt.current.rotation.z = THREE.MathUtils.lerp(tilt.current.rotation.z, -state.pointer.x * 0.14, damp);
    }
    if (core.current) core.current.scale.setScalar(1 + Math.sin(t * 1.2) * 0.05);
  });

  return (
    <group ref={bob}>
      <group ref={tilt}>
        <group ref={spin}>
          {/* glowing memory-graph core */}
          <mesh ref={core}>
            <icosahedronGeometry args={[0.85, 2]} />
            <meshStandardMaterial
              color={VIOLET}
              emissive={VIOLET}
              emissiveIntensity={1.4}
              wireframe
              transparent
              opacity={0.5}
            />
          </mesh>
          <mesh>
            <icosahedronGeometry args={[0.5, 1]} />
            <meshStandardMaterial color={CYAN} emissive={CYAN} emissiveIntensity={1.8} toneMapped={false} />
          </mesh>

          {/* relationship edges */}
          {edges.map(([a, b], i) => (
            <Line key={i} points={[a, b]} color={VIOLET} lineWidth={0.7} transparent opacity={0.16} />
          ))}

          {/* entity nodes (rounder, higher-res for smoothness) */}
          {nodes.map((n, i) => (
            <mesh key={i} position={n.pos}>
              <sphereGeometry args={[n.size, 32, 32]} />
              <meshStandardMaterial
                color={n.color}
                emissive={n.color}
                emissiveIntensity={n.threat ? 2.4 : 1.5}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>

        <Sparkles count={60} scale={10} size={2.2} speed={0.25} opacity={0.35} color={VIOLET} />
      </group>
    </group>
  );
}

export default function HeroGraph3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 7.2], fov: 42 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.45} />
      <pointLight position={[6, 4, 6]} intensity={90} color={VIOLET} />
      <pointLight position={[-6, -3, 4]} intensity={70} color={CYAN} />
      <Constellation />
      <EffectComposer>
        <Bloom
          intensity={0.85}
          luminanceThreshold={0.15}
          luminanceSmoothing={0.4}
          mipmapBlur
          radius={0.75}
        />
      </EffectComposer>
    </Canvas>
  );
}
