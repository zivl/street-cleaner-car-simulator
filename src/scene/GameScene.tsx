import { Sky, Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { DIRT_TYPES } from '../data/dirtTypes';
import type { Game } from '../game/Game';
import { input } from '../game/Input';
import { damp } from '../game/random';
import { useSave } from '../state/gameState';
import { DirtLayer } from './DirtLayer';
import { Effects } from './Effects';
import { carGeometry, carLightsGeometry, busGeometry } from './propGeometry';
import { TruckModel, makeTruckVisual } from './Truck';
import { World } from './World';
import { radialGlowTexture } from './textures';

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();

/** Steps the simulation and places the player truck. Must mount before CameraRig. */
function PlayerTruck({ game, truckRef }: { game: Game; truckRef: React.RefObject<THREE.Group | null> }) {
  const visual = useMemo(() => makeTruckVisual(), []);
  const upgrades = useSave((s) => s.upgrades);

  useFrame((_, dt) => {
    game.update(dt);
    const v = game.vehicle;
    const g = truckRef.current;
    if (g) {
      g.position.set(v.x, game.rideHeight, v.z);
      g.rotation.set(game.bodyPitch, v.heading, game.bodyRoll, 'YXZ');
    }
    visual.brushDeploy = game.brushDeploy;
    visual.brushSpin = game.brushSpin;
    visual.wheelSpin = v.wheelSpin;
    visual.steer = v.steerAngle;
    visual.lights = game.lights;
    visual.braking = v.braking;
    visual.beacon = game.brushes;
    visual.camBlend = game.camBlend;
    visual.time += dt;
  });

  return (
    <group ref={truckRef}>
      <TruckModel visual={visual} upgrades={upgrades} />
    </group>
  );
}

function CameraRig({ game, truckRef }: { game: Game; truckRef: React.RefObject<THREE.Group | null> }) {
  const { camera, gl } = useThree();
  const sensitivity = useSave((s) => s.settings.cameraSensitivity);
  const tp = useRef(new THREE.Vector3());
  const tpInit = useRef(false);
  const look = useRef({ yaw: 0, pitch: 0 });

  // Drag to look around (mouse or touch on the canvas).
  useEffect(() => {
    const el = gl.domElement;
    let active: number | null = null;
    let lx = 0;
    let ly = 0;
    const down = (e: PointerEvent) => {
      if (active !== null) return;
      active = e.pointerId;
      lx = e.clientX;
      ly = e.clientY;
      input.looking = true;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== active) return;
      const k = 0.005 * sensitivity;
      input.lookYaw = Math.max(-2.4, Math.min(2.4, input.lookYaw - (e.clientX - lx) * k));
      input.lookPitch = Math.max(-0.5, Math.min(0.6, input.lookPitch - (e.clientY - ly) * k));
      lx = e.clientX;
      ly = e.clientY;
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== active) return;
      active = null;
      input.looking = false;
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [gl, sensitivity]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const truck = truckRef.current;
    if (!truck) return;
    truck.updateMatrixWorld();
    const v = game.vehicle;

    // Look offset springs back when not dragging.
    if (!input.looking) {
      input.lookYaw *= 1 - damp(3, dt);
      input.lookPitch *= 1 - damp(3, dt);
    }
    look.current.yaw += (input.lookYaw - look.current.yaw) * damp(12, dt);
    look.current.pitch += (input.lookPitch - look.current.pitch) * damp(12, dt);
    const yaw = look.current.yaw;
    const pitch = look.current.pitch;

    // First-person: rigid to the cab.
    const fpPos = tmpV.set(0.55, 2.52, 1.95);
    truck.localToWorld(fpPos);
    const fh = v.heading + yaw;
    const fpTarget = tmpV2.set(fpPos.x + Math.sin(fh) * 10, fpPos.y - 1.1 + pitch * 10, fpPos.z + Math.cos(fh) * 10);

    // Third-person: smoothed chase camera.
    const th = v.heading + yaw;
    const dist = 11.5;
    const height = 5.2 + pitch * 6;
    const desired = new THREE.Vector3(v.x - Math.sin(th) * dist, height, v.z - Math.cos(th) * dist);
    if (!tpInit.current) {
      tp.current.copy(desired);
      tpInit.current = true;
    }
    tp.current.lerp(desired, damp(3.5 * sensitivity, dt));
    const tpTarget = new THREE.Vector3(v.x + Math.sin(v.heading) * 4, 1.6, v.z + Math.cos(v.heading) * 4);

    const b = game.camBlend;
    const e = b * b * (3 - 2 * b);
    camera.position.copy(fpPos).lerp(tp.current, e);
    const target = fpTarget.clone().lerp(tpTarget, e);

    if (game.shake > 0) {
      const s = game.shake * 0.25;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
      camera.position.z += (Math.random() - 0.5) * s;
    }
    camera.lookAt(target);
    // Roll with the truck body in first person.
    if (e < 0.5) camera.rotateZ(-game.bodyRoll * (1 - e * 2));
    const pc = camera as THREE.PerspectiveCamera;
    const fov = 72 - e * 12 + Math.min(6, Math.abs(v.speed) * 0.35);
    if (Math.abs(pc.fov - fov) > 0.05) {
      pc.fov += (fov - pc.fov) * damp(4, dt);
      pc.updateProjectionMatrix();
    }
  });
  return null;
}

function Traffic({ game }: { game: Game }) {
  const cars = game.traffic.cars;
  const { carMesh, busMesh, lightMesh, dispose } = useMemo(() => {
    const paint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.4 });
    const lightMat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#ffffff', emissiveIntensity: game.env.lampGlow > 0 ? 1.4 : 0.1 });
    const nCar = Math.max(1, cars.filter((c) => !c.bus).length);
    const nBus = Math.max(1, cars.filter((c) => c.bus).length);
    const carMesh = new THREE.InstancedMesh(carGeometry(), paint, nCar);
    const busMesh = new THREE.InstancedMesh(busGeometry(), paint, nBus);
    const lightMesh = new THREE.InstancedMesh(carLightsGeometry(), lightMat, Math.max(1, cars.length));
    let ci = 0;
    let bi = 0;
    for (const c of cars) {
      if (c.bus) busMesh.setColorAt(bi++, new THREE.Color(c.color));
      else carMesh.setColorAt(ci++, new THREE.Color(c.color));
    }
    carMesh.count = ci;
    busMesh.count = bi;
    lightMesh.count = cars.length;
    for (const m of [carMesh, busMesh, lightMesh]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.castShadow = m !== lightMesh;
    }
    return {
      carMesh,
      busMesh,
      lightMesh,
      dispose: () => {
        for (const m of [carMesh, busMesh, lightMesh]) m.geometry.dispose();
        paint.dispose();
        lightMat.dispose();
      },
    };
  }, [cars, game]);
  useEffect(() => dispose, [dispose]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    let ci = 0;
    let bi = 0;
    cars.forEach((c, i) => {
      dummy.position.set(c.x, 0, c.z);
      dummy.rotation.set(0, c.heading, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      if (c.bus) {
        busMesh.setMatrixAt(bi++, dummy.matrix);
        dummy.scale.set(1.3, 1, 2.3);
        dummy.updateMatrix();
      } else carMesh.setMatrixAt(ci++, dummy.matrix);
      lightMesh.setMatrixAt(i, dummy.matrix);
    });
    carMesh.instanceMatrix.needsUpdate = true;
    busMesh.instanceMatrix.needsUpdate = true;
    lightMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <primitive object={carMesh} />
      <primitive object={busMesh} />
      <primitive object={lightMesh} />
    </>
  );
}

function Pickups({ game }: { game: Game }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const glow = useMemo(() => radialGlowTexture(), []);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    game.pickups.forEach((p, i) => {
      const g = refs.current[i];
      if (!g) return;
      g.visible = p.alive;
      const inner = g.children[0];
      inner.position.y = 1.3 + Math.sin(t * 2 + i) * 0.2;
      inner.rotation.y = t * 1.5;
    });
  });
  return (
    <>
      {game.pickups.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]} ref={(g) => void (refs.current[i] = g)}>
          <group>
            {p.kind === 'fuel' ? (
              <>
                <mesh castShadow>
                  <boxGeometry args={[0.7, 0.9, 0.35]} />
                  <meshStandardMaterial color="#e11d2a" emissive="#ff3b30" emissiveIntensity={0.35} metalness={0.4} roughness={0.35} />
                </mesh>
                <mesh position={[0.18, 0.55, 0]}>
                  <cylinderGeometry args={[0.07, 0.07, 0.25, 8]} />
                  <meshStandardMaterial color="#222" />
                </mesh>
                <mesh position={[-0.12, 0.5, 0]}>
                  <boxGeometry args={[0.35, 0.08, 0.12]} />
                  <meshStandardMaterial color="#222" />
                </mesh>
              </>
            ) : (
              <>
                <mesh castShadow>
                  <boxGeometry args={[0.85, 0.6, 0.5]} />
                  <meshStandardMaterial color="#16a34a" emissive="#22c55e" emissiveIntensity={0.35} roughness={0.4} />
                </mesh>
                <mesh position={[0, 0, 0.26]}>
                  <boxGeometry args={[0.45, 0.13, 0.02]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
                <mesh position={[0, 0, 0.26]}>
                  <boxGeometry args={[0.13, 0.45, 0.02]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
              </>
            )}
          </group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
            <planeGeometry args={[4, 4]} />
            <meshBasicMaterial map={glow} color={p.kind === 'fuel' ? '#ffcc33' : '#4ade80'} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh position={[0, 3, 0]}>
            <cylinderGeometry args={[0.6, 0.6, 6, 16, 1, true]} />
            <meshBasicMaterial color={p.kind === 'fuel' ? '#ffcc33' : '#4ade80'} transparent opacity={0.12} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Pulsing markers floating above radar-detected dirt. */
function RadarMarkers({ game }: { game: Game }) {
  const MAX = 48;
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.35, 0),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false }),
      MAX,
    );
    m.frustumCulled = false;
    m.count = 0;
    for (let i = 0; i < MAX; i++) m.setColorAt(i, new THREE.Color('#3de0ff'));
    return m;
  }, []);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    },
    [mesh],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const blips = game.blips;
    const tier = game.stats.radarTier;
    const n = Math.min(MAX, blips.length);
    for (let i = 0; i < n; i++) {
      const b = blips[i];
      const pulse = 1 + Math.sin(t * 4 + i) * 0.2;
      dummy.position.set(b.x, 2.4 + Math.sin(t * 2 + i * 0.7) * 0.25, b.z);
      dummy.rotation.set(0, t * 2, 0);
      dummy.scale.setScalar((0.45 + b.strength * 0.6) * pulse);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      col.set(tier >= 3 ? DIRT_TYPES[b.type].blip : '#3de0ff');
      mesh.setColorAt(i, col);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}

function Rain({ game }: { game: Game }) {
  const N = 2500;
  const { lines, positions } = useMemo(() => {
    const positions = new Float32Array(N * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: '#aac4dd', transparent: true, opacity: 0.35 });
    const lines = new THREE.LineSegments(geo, mat);
    lines.frustumCulled = false;
    for (let i = 0; i < N; i++) {
      const x = (Math.random() - 0.5) * 60;
      const y = Math.random() * 25;
      const z = (Math.random() - 0.5) * 60;
      positions.set([x, y, z, x + 0.05, y + 0.6, z], i * 6);
    }
    return { lines, positions };
  }, []);
  useEffect(
    () => () => {
      lines.geometry.dispose();
      (lines.material as THREE.Material).dispose();
    },
    [lines],
  );
  useFrame((_, dt) => {
    const v = game.vehicle;
    lines.position.set(v.x, 0, v.z);
    const fall = 22 * Math.min(dt, 0.1);
    for (let i = 0; i < N; i++) {
      const o = i * 6;
      positions[o + 1] -= fall;
      positions[o + 4] -= fall;
      if (positions[o + 1] < 0) {
        positions[o + 1] += 25;
        positions[o + 4] += 25;
      }
    }
    lines.geometry.attributes.position.needsUpdate = true;
  });
  return <primitive object={lines} />;
}

function Lighting({ game, shadows, shadowSize, streetLights }: { game: Game; shadows: boolean; shadowSize: number; streetLights: number }) {
  const env = game.env;
  const sun = useRef<THREE.DirectionalLight>(null);
  const { gl, scene } = useThree();
  const lampPool = useRef<(THREE.PointLight | null)[]>([]);
  const lamps = useMemo(() => game.layout.props.filter((p) => p.kind === 'lamp'), [game]);
  const lampHeight = game.city.lampStyle === 'modern' ? 6.5 : game.city.lampStyle === 'classic' ? 5 : 4.4;
  const lampReach = game.city.lampStyle === 'modern' ? 2.15 : 0;

  const sunDir = useMemo(() => {
    const el = THREE.MathUtils.degToRad(env.sunElevation);
    const az = THREE.MathUtils.degToRad(env.sunAzimuth);
    return new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  }, [env]);

  useEffect(() => {
    gl.toneMappingExposure = env.exposure;
    scene.fog = new THREE.Fog(env.fog, env.fogNear, env.fogFar);
    scene.background = new THREE.Color(env.background);
    return () => {
      scene.fog = null;
    };
  }, [env, gl, scene]);

  const lampTimer = useRef(0);
  useFrame((_, dt) => {
    const v = game.vehicle;
    if (sun.current) {
      sun.current.position.set(v.x + sunDir.x * 80, sunDir.y * 80, v.z + sunDir.z * 80);
      sun.current.target.position.set(v.x, 0, v.z);
      sun.current.target.updateMatrixWorld();
    }
    lampTimer.current -= dt;
    if (streetLights > 0 && env.streetLights > 0 && lampTimer.current <= 0) {
      lampTimer.current = 0.4;
      // Move pooled lights to the lamps nearest to (and ahead of) the truck.
      const fx = v.x + Math.sin(v.heading) * 12;
      const fz = v.z + Math.cos(v.heading) * 12;
      const sorted = lamps
        .map((l) => ({ l, d: (l.x - fx) ** 2 + (l.z - fz) ** 2 }))
        .sort((a, b) => a.d - b.d)
        .slice(0, streetLights);
      sorted.forEach(({ l }, i) => {
        const pl = lampPool.current[i];
        if (!pl) return;
        pl.position.set(l.x + Math.sin(l.rot) * lampReach, lampHeight, l.z + Math.cos(l.rot) * lampReach);
      });
    }
  });

  return (
    <>
      <hemisphereLight args={[env.hemiSky, env.hemiGround, env.hemiIntensity]} />
      <directionalLight
        ref={sun}
        color={env.sunColor}
        intensity={env.sunIntensity}
        castShadow={shadows}
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-near={1}
        shadow-camera-far={220}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      {Array.from({ length: streetLights }, (_, i) => (
        <pointLight
          key={i}
          ref={(p) => void (lampPool.current[i] = p)}
          color="#ffcf8a"
          intensity={env.streetLights * 9}
          distance={20}
          decay={1.2}
          position={[0, -50, 0]}
        />
      ))}
      {env.useSky && <Sky distance={4000} sunPosition={sunDir.clone().multiplyScalar(100)} turbidity={env.turbidity} rayleigh={env.rayleigh} mieCoefficient={0.006} mieDirectionalG={0.85} />}
      {env.stars && <Stars radius={600} depth={80} count={2500} factor={5} fade speed={0.5} />}
      {game.level.weather === 'rain' && <Rain game={game} />}
    </>
  );
}

export interface SceneQuality {
  shadows: boolean;
  shadowSize: number;
  density: number;
  streetLights: number;
}

export function GameScene({ game, quality }: { game: Game; quality: SceneQuality }) {
  const truckRef = useRef<THREE.Group>(null);
  return (
    <>
      <Lighting game={game} shadows={quality.shadows} shadowSize={quality.shadowSize} streetLights={quality.streetLights} />
      <World game={game} shadows={quality.shadows} density={quality.density} />
      <DirtLayer game={game} />
      <PlayerTruck game={game} truckRef={truckRef} />
      <Traffic game={game} />
      <Pickups game={game} />
      <RadarMarkers game={game} />
      <Effects game={game} />
      <CameraRig game={game} truckRef={truckRef} />
    </>
  );
}
