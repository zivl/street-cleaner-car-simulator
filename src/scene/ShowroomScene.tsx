import { ContactShadows, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSave } from '../state/gameState';
import { TruckModel, makeTruckVisual } from './Truck';

function ShowTruck({ spin }: { spin: boolean }) {
  const upgrades = useSave((s) => s.upgrades);
  const visual = useMemo(() => {
    const v = makeTruckVisual();
    v.brushDeploy = 1;
    v.beacon = true;
    v.lights = true;
    return v;
  }, []);
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    visual.time += dt;
    visual.brushSpin += dt * 10;
    visual.wheelSpin += dt * (spin ? 2 : 0);
    visual.steer = Math.sin(visual.time * 0.6) * 0.25;
    if (group.current && spin) group.current.rotation.y += dt * 0.25;
  });
  return (
    <group ref={group}>
      <TruckModel visual={visual} upgrades={upgrades} withLights={false} />
    </group>
  );
}

function Floor() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d')!;
    g.fillStyle = '#1a2130';
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(255,255,255,0.06)';
    g.lineWidth = 2;
    for (let i = 0; i <= 512; i += 64) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, 512);
      g.moveTo(0, i);
      g.lineTo(512, i);
      g.stroke();
    }
    g.strokeStyle = 'rgba(255,170,0,0.5)';
    g.lineWidth = 8;
    g.setLineDash([30, 22]);
    g.beginPath();
    g.arc(256, 256, 200, 0, Math.PI * 2);
    g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[9, 64]} />
      <meshStandardMaterial map={tex} roughness={0.6} metalness={0.2} />
    </mesh>
  );
}

export function ShowroomScene({ mode }: { mode: 'menu' | 'garage' }) {
  const menu = mode === 'menu';
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: menu ? [13, 5, 11] : [9, 4.5, 9], fov: menu ? 36 : 42 }}
      gl={{ antialias: true }}
      className="showroom-canvas"
    >
      <color attach="background" args={[menu ? '#0b1220' : '#101826']} />
      <fog attach="fog" args={[menu ? '#0b1220' : '#101826', 18, 45]} />
      <hemisphereLight args={['#bcd7ff', '#2a2230', 0.9]} />
      <directionalLight position={[6, 12, 6]} intensity={2.4} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <pointLight position={[-6, 4, -4]} intensity={40} color="#ff8a3d" distance={20} />
      <pointLight position={[6, 3, -6]} intensity={40} color="#3de0ff" distance={20} />
      <group position={[menu ? 2.5 : 0, 0, menu ? -2.5 : 0]}>
        <ShowTruck spin={menu} />
        <Floor />
        <ContactShadows position={[0, 0.01, 0]} opacity={0.6} scale={16} blur={2.4} far={4} />
      </group>
      {!menu && <OrbitControls enablePan={false} minDistance={7} maxDistance={18} minPolarAngle={0.3} maxPolarAngle={1.45} target={[0, 1.4, 0]} autoRotate autoRotateSpeed={0.6} />}
    </Canvas>
  );
}
