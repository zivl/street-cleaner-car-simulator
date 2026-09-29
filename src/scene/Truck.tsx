import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { UpgradeLevels } from '../data/upgrades';
import { statValue } from '../data/upgrades';

/** Mutable visual state the truck model reads every frame. */
export interface TruckVisual {
  brushDeploy: number;
  brushSpin: number;
  wheelSpin: number;
  steer: number;
  lights: boolean;
  braking: boolean;
  beacon: boolean;
  /** 0 = first person (hide cab shell, show cockpit), 1 = third person */
  camBlend: number;
  time: number;
}

export function makeTruckVisual(): TruckVisual {
  return { brushDeploy: 0, brushSpin: 0, wheelSpin: 0, steer: 0, lights: false, braking: false, beacon: false, camBlend: 1, time: 0 };
}

const WHITE = '#f4f6f8';
const ORANGE = '#ff7a00';
const DARK = '#23272c';
const GLASS = '#1a2b3a';

function logoTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(0,0,0,0)';
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#0f766e';
  g.beginPath();
  g.arc(64, 64, 46, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ffffff';
  g.font = 'bold 54px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('♻', 64, 68);
  g.fillStyle = '#0f3d3a';
  g.font = 'bold 50px Rajdhani, Inter, sans-serif';
  g.textAlign = 'left';
  g.fillText('CITY CLEAN', 126, 52);
  g.font = '600 26px Inter, sans-serif';
  g.fillStyle = '#39514f';
  g.fillText('MUNICIPAL SERVICES', 128, 96);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function Wheel({ position, rimColor, spinRef, steerRef }: { position: [number, number, number]; rimColor: string; spinRef: (o: THREE.Object3D | null) => void; steerRef?: (o: THREE.Object3D | null) => void }) {
  return (
    <group position={position} ref={steerRef}>
      <group ref={spinRef}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.52, 0.52, 0.4, 18]} />
          <meshStandardMaterial color="#141414" roughness={0.9} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]} position={[position[0] > 0 ? 0.205 : -0.205, 0, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.02, 12]} />
          <meshStandardMaterial color={rimColor} metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[position[0] > 0 ? 0.215 : -0.215, 0.18, 0]}>
          <boxGeometry args={[0.02, 0.08, 0.08]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      </group>
    </group>
  );
}

function SideBroom({ side, spinRef, armRef }: { side: 1 | -1; spinRef: (o: THREE.Object3D | null) => void; armRef: (o: THREE.Object3D | null) => void }) {
  const bristles = useMemo(() => {
    const arr: [number, number][] = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      arr.push([Math.sin(a) * 0.42, Math.cos(a) * 0.42]);
    }
    return arr;
  }, []);
  return (
    <group ref={armRef}>
      <group ref={spinRef}>
        <mesh castShadow>
          <cylinderGeometry args={[0.32, 0.34, 0.1, 16]} />
          <meshStandardMaterial color="#303338" metalness={0.4} roughness={0.5} />
        </mesh>
        {bristles.map(([x, z], i) => (
          <mesh key={i} position={[x, -0.08, z]} rotation={[z * 0.9, 0, -x * 0.9]}>
            <boxGeometry args={[0.07, 0.24, 0.07]} />
            <meshStandardMaterial color={i % 2 ? '#1b1b1b' : '#8a5a1c'} roughness={1} />
          </mesh>
        ))}
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.12, 8]} />
          <meshStandardMaterial color={ORANGE} />
        </mesh>
      </group>
      <mesh position={[-side * 0.35, 0.3, -0.3]} rotation={[0.5, 0, side * 0.7]}>
        <boxGeometry args={[0.08, 0.8, 0.08]} />
        <meshStandardMaterial color={DARK} metalness={0.5} />
      </mesh>
    </group>
  );
}

export function TruckModel({ visual, upgrades, withLights = true }: { visual: TruckVisual; upgrades: UpgradeLevels; withLights?: boolean }) {
  const brushWidth = statValue(upgrades, 'brushes', 'width');
  const radarLevel = upgrades.radar;
  const foamLevel = upgrades.foam;
  const wheelLevel = upgrades.wheels;
  const engineLevel = upgrades.engine;
  const rimColor = ['#9aa3ad', '#b8c0c8', '#d4af37', '#e5e7eb', '#ff7a00'][wheelLevel - 1];

  const wheelSpins = useRef<THREE.Object3D[]>([]);
  const wheelSteer = useRef<THREE.Object3D[]>([]);
  const broomSpin = useRef<THREE.Object3D[]>([]);
  const broomArm = useRef<THREE.Object3D[]>([]);
  const mainBroom = useRef<THREE.Mesh>(null);
  const shell = useRef<THREE.Group>(null);
  const cockpit = useRef<THREE.Group>(null);
  const steering = useRef<THREE.Group>(null);
  const radarDish = useRef<THREE.Group>(null);
  const spotL = useRef<THREE.SpotLight>(null);
  const spotR = useRef<THREE.SpotLight>(null);
  const targetL = useMemo(() => new THREE.Object3D(), []);
  const targetR = useMemo(() => new THREE.Object3D(), []);

  const mats = useMemo(
    () => ({
      head: new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff4cc', emissiveIntensity: 0 }),
      tail: new THREE.MeshStandardMaterial({ color: '#7a0b0b', emissive: '#ff1a1a', emissiveIntensity: 0.3 }),
      beacon: new THREE.MeshStandardMaterial({ color: '#ffae00', emissive: '#ff9500', emissiveIntensity: 0, transparent: true, opacity: 0.9 }),
      logo: new THREE.MeshStandardMaterial({ map: logoTexture(), transparent: true, roughness: 0.5 }),
    }),
    [],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  const broomX = Math.max(0.75, brushWidth / 2 - 0.45);

  useFrame(() => {
    const v = visual;
    for (const w of wheelSpins.current) if (w) w.rotation.x = v.wheelSpin;
    for (const w of wheelSteer.current) if (w) w.rotation.y = v.steer;
    broomSpin.current.forEach((b, i) => {
      if (b) b.rotation.y = v.brushSpin * (i === 0 ? 1 : -1);
    });
    broomArm.current.forEach((a, i) => {
      if (!a) return;
      const side = i === 0 ? 1 : -1;
      const d = v.brushDeploy;
      a.position.set(side * (broomX * (0.75 + d * 0.25)), 0.55 - d * 0.42, 3.35 + d * 0.15);
      a.rotation.z = side * (1 - d) * 0.5;
    });
    if (mainBroom.current) {
      mainBroom.current.rotation.x = -v.brushSpin * 1.3;
      mainBroom.current.position.y = 0.52 - v.brushDeploy * 0.2;
    }
    const fp = v.camBlend < 0.35;
    if (shell.current) shell.current.visible = !fp;
    if (cockpit.current) cockpit.current.visible = v.camBlend < 0.6;
    if (steering.current) steering.current.rotation.z = -v.steer * 5;
    if (radarDish.current) radarDish.current.rotation.y = v.time * 2.2;
    mats.head.emissiveIntensity = v.lights ? 3 : 0.05;
    mats.tail.emissiveIntensity = v.braking ? 3 : v.lights ? 1.2 : 0.2;
    const flash = v.beacon ? (Math.sin(v.time * 12) > 0 ? 4 : 0.4) : 0;
    mats.beacon.emissiveIntensity = flash;
    const li = v.lights ? 45 : 0;
    if (spotL.current) spotL.current.intensity = li;
    if (spotR.current) spotR.current.intensity = li;
  });

  useEffect(() => {
    if (spotL.current) spotL.current.target = targetL;
    if (spotR.current) spotR.current.target = targetR;
  }, [targetL, targetR]);

  const foamTankLen = 1.6 + foamLevel * 0.25;

  return (
    <group>
      {/* Chassis */}
      <mesh position={[0, 0.72, -0.1]} castShadow>
        <boxGeometry args={[2.1, 0.4, 6.3]} />
        <meshStandardMaterial color={DARK} roughness={0.7} />
      </mesh>
      {/* Front bumper with foam nozzles */}
      <mesh position={[0, 0.65, 3.28]} castShadow>
        <boxGeometry args={[2.45, 0.35, 0.22]} />
        <meshStandardMaterial color="#3a3f45" metalness={0.3} />
      </mesh>
      {[-0.7, -0.25, 0.25, 0.7].map((x) => (
        <mesh key={x} position={[x, 0.5, 3.42]} rotation={[Math.PI / 2 + 0.5, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.05, 0.14, 6]} />
          <meshStandardMaterial color="#c0c7cf" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}

      {/* Cab shell (hidden in first person) */}
      <group ref={shell}>
        <mesh position={[0, 2.0, 2.35]} castShadow>
          <boxGeometry args={[2.4, 2.0, 1.9]} />
          <meshStandardMaterial color={WHITE} roughness={0.35} metalness={0.1} />
        </mesh>
        <mesh position={[0, 3.02, 2.3]} castShadow>
          <boxGeometry args={[2.3, 0.08, 1.8]} />
          <meshStandardMaterial color={WHITE} roughness={0.35} />
        </mesh>
        {/* Windshield + side windows */}
        <mesh position={[0, 2.4, 3.31]}>
          <boxGeometry args={[2.2, 0.95, 0.04]} />
          <meshStandardMaterial color={GLASS} roughness={0.05} metalness={0.6} />
        </mesh>
        <mesh position={[1.205, 2.4, 2.45]}>
          <boxGeometry args={[0.02, 0.8, 1.3]} />
          <meshStandardMaterial color={GLASS} roughness={0.05} metalness={0.6} />
        </mesh>
        <mesh position={[-1.205, 2.4, 2.45]}>
          <boxGeometry args={[0.02, 0.8, 1.3]} />
          <meshStandardMaterial color={GLASS} roughness={0.05} metalness={0.6} />
        </mesh>
        {/* Orange stripe around cab */}
        <mesh position={[0, 1.55, 2.35]}>
          <boxGeometry args={[2.42, 0.22, 1.92]} />
          <meshStandardMaterial color={ORANGE} roughness={0.4} />
        </mesh>
        {/* Grille */}
        <mesh position={[0, 1.25, 3.31]}>
          <boxGeometry args={[1.2, 0.35, 0.04]} />
          <meshStandardMaterial color="#1b1e22" />
        </mesh>
      </group>

      {/* Headlights */}
      <mesh position={[0.82, 1.22, 3.31]} material={mats.head}>
        <boxGeometry args={[0.42, 0.22, 0.05]} />
      </mesh>
      <mesh position={[-0.82, 1.22, 3.31]} material={mats.head}>
        <boxGeometry args={[0.42, 0.22, 0.05]} />
      </mesh>
      {withLights && (
        <>
          <spotLight ref={spotL} position={[0.8, 1.3, 3.3]} angle={0.55} penumbra={0.6} distance={70} decay={1.3} color="#fff3d6" intensity={0} />
          <spotLight ref={spotR} position={[-0.8, 1.3, 3.3]} angle={0.55} penumbra={0.6} distance={70} decay={1.3} color="#fff3d6" intensity={0} />
          <primitive object={targetL} position={[1.4, 0, 22]} />
          <primitive object={targetR} position={[-1.4, 0, 22]} />
        </>
      )}

      {/* Beacon */}
      <mesh position={[0, 3.18, 2.2]} material={mats.beacon}>
        <cylinderGeometry args={[0.16, 0.18, 0.22, 12]} />
      </mesh>
      <mesh position={[0, 3.08, 2.2]}>
        <boxGeometry args={[1.4, 0.06, 0.18]} />
        <meshStandardMaterial color={DARK} />
      </mesh>

      {/* Hopper body */}
      <mesh position={[0, 1.55, -1.0]} castShadow>
        <boxGeometry args={[2.36, 1.1, 4.4]} />
        <meshStandardMaterial color={ORANGE} roughness={0.45} />
      </mesh>
      <mesh position={[0, 2.45, -1.0]} castShadow>
        <boxGeometry args={[2.36, 0.7, 4.4]} />
        <meshStandardMaterial color={WHITE} roughness={0.4} />
      </mesh>
      <mesh position={[0, 2.8, -1.0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.4]} castShadow>
        <cylinderGeometry args={[1.18, 1.18, 4.4, 20, 1, false, -Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color={WHITE} roughness={0.4} />
      </mesh>
      {/* Logo panels */}
      <mesh position={[1.19, 2.35, -1.0]} rotation={[0, Math.PI / 2, 0]} material={mats.logo}>
        <planeGeometry args={[3.2, 0.8]} />
      </mesh>
      <mesh position={[-1.19, 2.35, -1.0]} rotation={[0, -Math.PI / 2, 0]} material={mats.logo}>
        <planeGeometry args={[3.2, 0.8]} />
      </mesh>
      {/* Rear door */}
      <mesh position={[0, 2.0, -3.21]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.95, 0.95, 0.06, 20]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.4} />
      </mesh>
      <mesh position={[0.95, 1.2, -3.2]} material={mats.tail}>
        <boxGeometry args={[0.3, 0.18, 0.04]} />
      </mesh>
      <mesh position={[-0.95, 1.2, -3.2]} material={mats.tail}>
        <boxGeometry args={[0.3, 0.18, 0.04]} />
      </mesh>

      {/* Foam tank (grows with upgrades) */}
      <mesh position={[1.25, 1.2, -1.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.28, foamTankLen, 14]} />
        <meshStandardMaterial color="#e0f2fe" metalness={0.5} roughness={0.25} />
      </mesh>
      {/* Water tank */}
      <mesh position={[-1.25, 1.2, -1.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 2.4, 14]} />
        <meshStandardMaterial color="#3b82f6" metalness={0.3} roughness={0.35} />
      </mesh>

      {/* Exhaust stack */}
      <mesh position={[-1.0, 3.0, 1.3]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 1.2 + engineLevel * 0.1, 10]} />
        <meshStandardMaterial color={engineLevel >= 3 ? '#e5e7eb' : '#555'} metalness={engineLevel >= 3 ? 0.95 : 0.4} roughness={0.2} />
      </mesh>

      {/* Radar */}
      <group position={[0, 3.3, -2.2]}>
        <mesh>
          <cylinderGeometry args={[0.08, 0.1, 0.4, 8]} />
          <meshStandardMaterial color={DARK} />
        </mesh>
        <group ref={radarDish} position={[0, 0.25, 0]}>
          <mesh rotation={[0.5, 0, 0]} scale={0.6 + radarLevel * 0.15}>
            <sphereGeometry args={[0.35, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.5]} />
            <meshStandardMaterial color="#e5e7eb" side={THREE.DoubleSide} metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      </group>

      {/* Main cylindrical broom under the body */}
      <mesh ref={mainBroom} position={[0, 0.4, 0.2]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.33, 0.33, 1.9, 14]} />
        <meshStandardMaterial color="#5b3a14" roughness={1} />
      </mesh>

      {/* Side brooms */}
      <SideBroom side={1} spinRef={(o) => o && (broomSpin.current[0] = o)} armRef={(o) => o && (broomArm.current[0] = o)} />
      <SideBroom side={-1} spinRef={(o) => o && (broomSpin.current[1] = o)} armRef={(o) => o && (broomArm.current[1] = o)} />

      {/* Wheels */}
      {(
        [
          [1.1, 0.52, 2.2, true],
          [-1.1, 0.52, 2.2, true],
          [1.1, 0.52, -1.7, false],
          [-1.1, 0.52, -1.7, false],
        ] as [number, number, number, boolean][]
      ).map(([x, y, z, front], i) => (
        <Wheel
          key={i}
          position={[x, y, z]}
          rimColor={rimColor}
          spinRef={(o) => o && (wheelSpins.current[i] = o)}
          steerRef={front ? (o) => o && (wheelSteer.current[i] = o) : undefined}
        />
      ))}

      {/* Side mirrors (visible from cockpit too) */}
      {[1, -1].map((s) => (
        <group key={s} position={[s * 1.5, 2.3, 3.3]}>
          <mesh position={[-s * 0.12, 0, 0]}>
            <boxGeometry args={[0.25, 0.04, 0.04]} />
            <meshStandardMaterial color={DARK} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.08, 0.42, 0.24]} />
            <meshStandardMaterial color={DARK} />
          </mesh>
          <mesh position={[0, 0, -0.125]}>
            <boxGeometry args={[0.06, 0.36, 0.01]} />
            <meshStandardMaterial color="#b9d7ee" metalness={0.9} roughness={0.05} />
          </mesh>
        </group>
      ))}

      {/* Cockpit interior (first person) */}
      <group ref={cockpit}>
        <mesh position={[0, 1.72, 3.05]}>
          <boxGeometry args={[2.3, 0.3, 0.45]} />
          <meshStandardMaterial color="#2a2e33" roughness={0.8} />
        </mesh>
        <mesh position={[0.55, 1.9, 2.95]} rotation={[-0.6, 0, 0]}>
          <boxGeometry args={[0.36, 0.12, 0.03]} />
          <meshStandardMaterial color="#0c0f14" emissive="#1e90ff" emissiveIntensity={0.12} roughness={0.3} />
        </mesh>
        <mesh position={[-0.05, 1.89, 2.97]} rotation={[-0.6, 0, 0]}>
          <boxGeometry args={[0.26, 0.1, 0.03]} />
          <meshStandardMaterial color="#0c0f14" emissive="#22c55e" emissiveIntensity={0.1} roughness={0.3} />
        </mesh>
        {/* A-pillars and header */}
        <mesh position={[1.17, 2.4, 3.25]} rotation={[0.12, 0, 0]}>
          <boxGeometry args={[0.07, 1.1, 0.1]} />
          <meshStandardMaterial color="#e8eaed" />
        </mesh>
        <mesh position={[-1.17, 2.4, 3.25]} rotation={[0.12, 0, 0]}>
          <boxGeometry args={[0.07, 1.1, 0.1]} />
          <meshStandardMaterial color="#e8eaed" />
        </mesh>
        <mesh position={[0, 3.0, 3.22]}>
          <boxGeometry args={[2.4, 0.1, 0.2]} />
          <meshStandardMaterial color="#d8dadd" />
        </mesh>
        <mesh position={[0.45, 2.95, 3.0]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.5, 0.03, 0.2]} />
          <meshStandardMaterial color="#3a3f45" />
        </mesh>
        {/* Door sills */}
        <mesh position={[1.16, 1.85, 2.45]}>
          <boxGeometry args={[0.1, 0.12, 1.4]} />
          <meshStandardMaterial color="#e8eaed" />
        </mesh>
        <mesh position={[-1.16, 1.85, 2.45]}>
          <boxGeometry args={[0.1, 0.12, 1.4]} />
          <meshStandardMaterial color="#e8eaed" />
        </mesh>
        {/* Steering wheel */}
        <group ref={steering} position={[0.55, 1.98, 2.6]} rotation={[-0.9, 0, 0]}>
          <group>
            <mesh>
              <torusGeometry args={[0.2, 0.028, 8, 28]} />
              <meshStandardMaterial color="#15171a" roughness={0.6} />
            </mesh>
            <mesh>
              <boxGeometry args={[0.38, 0.03, 0.02]} />
              <meshStandardMaterial color="#15171a" />
            </mesh>
            <mesh position={[0, -0.09, 0]}>
              <boxGeometry args={[0.03, 0.18, 0.02]} />
              <meshStandardMaterial color="#15171a" />
            </mesh>
            <mesh>
              <cylinderGeometry args={[0.05, 0.05, 0.04, 12]} />
              <meshStandardMaterial color={ORANGE} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}
