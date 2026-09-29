import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Game } from '../game/Game';

/** Fixed-size particle pool rendered with one InstancedMesh. */
class ParticlePool {
  readonly mesh: THREE.InstancedMesh;
  private px: Float32Array;
  private py: Float32Array;
  private pz: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private vz: Float32Array;
  private life: Float32Array;
  private max: Float32Array;
  private size: Float32Array;
  private grow: Float32Array;
  private next = 0;
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();

  constructor(
    readonly capacity: number,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    private gravity = -9,
    private drag = 1.5,
    private floor = 0.03,
  ) {
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = capacity;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < capacity; i++) {
      this.mesh.setMatrixAt(i, zero);
      this.mesh.setColorAt(i, this.color.set('#ffffff'));
    }
    this.px = new Float32Array(capacity);
    this.py = new Float32Array(capacity);
    this.pz = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.vz = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.max = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.grow = new Float32Array(capacity);
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: string, grow = 0) {
    const i = this.next;
    this.next = (this.next + 1) % this.capacity;
    this.px[i] = x;
    this.py[i] = y;
    this.pz[i] = z;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.vz[i] = vz;
    this.life[i] = life;
    this.max[i] = life;
    this.size[i] = size;
    this.grow[i] = grow;
    this.mesh.setColorAt(i, this.color.set(color));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number) {
    const d = this.dummy;
    const drag = Math.exp(-this.drag * dt);
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        d.position.set(0, -100, 0);
        d.scale.setScalar(0);
        d.updateMatrix();
        this.mesh.setMatrixAt(i, d.matrix);
        continue;
      }
      this.vy[i] += this.gravity * dt;
      this.vx[i] *= drag;
      this.vy[i] *= drag;
      this.vz[i] *= drag;
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt;
      if (this.py[i] < this.floor) {
        this.py[i] = this.floor;
        this.vy[i] *= -0.2;
        this.vx[i] *= 0.6;
        this.vz[i] *= 0.6;
      }
      const t = this.life[i] / this.max[i];
      const s = this.size[i] * (this.grow[i] ? 1 + (1 - t) * this.grow[i] : Math.min(1, t * 3));
      d.position.set(this.px[i], this.py[i], this.pz[i]);
      d.rotation.set(t * 5, t * 7, 0);
      d.scale.setScalar(s);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

export function Effects({ game }: { game: Game }) {
  const pools = useMemo(() => {
    const dust = new ParticlePool(700, new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ vertexColors: false }), -7, 1.2);
    const foam = new ParticlePool(
      900,
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, transparent: true, opacity: 0.92 }),
      -9,
      0.6,
      0.05,
    );
    const spark = new ParticlePool(
      300,
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ toneMapped: false, blending: THREE.AdditiveBlending, transparent: true }),
      -12,
      0.5,
    );
    return { dust, foam, spark };
  }, []);

  useEffect(() => () => Object.values(pools).forEach((p) => p.dispose()), [pools]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    if (!game.paused) {
      // Game-emitted events.
      for (const e of game.fx) {
        for (let k = 0; k < e.count; k++) {
          if (e.kind === 'dust') {
            pools.dust.spawn(
              e.x + (Math.random() - 0.5) * 0.6,
              e.y,
              e.z + (Math.random() - 0.5) * 0.6,
              (Math.random() - 0.5) * 3,
              1.5 + Math.random() * 2.5,
              (Math.random() - 0.5) * 3,
              0.6 + Math.random() * 0.5,
              0.04 + Math.random() * 0.05,
              e.color,
            );
          } else if (e.kind === 'spark') {
            pools.spark.spawn(e.x, e.y, e.z, (Math.random() - 0.5) * 9, 2 + Math.random() * 5, (Math.random() - 0.5) * 9, 0.4 + Math.random() * 0.4, 0.05, e.color);
          } else {
            const a = Math.random() * Math.PI * 2;
            pools.spark.spawn(e.x, e.y, e.z, Math.cos(a) * 4, 3 + Math.random() * 4, Math.sin(a) * 4, 0.8 + Math.random() * 0.5, 0.09, e.color);
          }
        }
      }
      game.fx.length = 0;

      // Foam spray from the front nozzles.
      if (game.foaming) {
        const v = game.vehicle;
        const s = Math.sin(v.heading);
        const c = Math.cos(v.heading);
        const st = game.stats;
        const n = Math.ceil(90 * dt * (st.foamWidth / 3));
        for (let k = 0; k < n; k++) {
          const lx = (Math.random() - 0.5) * 1.6;
          const spread = (Math.random() - 0.5) * (st.foamWidth / st.foamRange) * 1.2;
          const speed = st.foamRange * (1.0 + Math.random() * 0.35);
          const fx = s + c * spread;
          const fz = c - s * spread;
          pools.foam.spawn(
            v.x + c * lx + s * 3.45,
            0.55,
            v.z - s * lx + c * 3.45,
            fx * speed + v.vx,
            1.6 + Math.random() * 1.2,
            fz * speed + v.vz,
            1.4 + Math.random() * 0.8,
            0.07 + Math.random() * 0.07,
            Math.random() < 0.2 ? '#dff4ff' : '#ffffff',
            1.6,
          );
        }
      }
      // Brush water mist while sweeping.
      if (game.brushes && game.brushDeploy > 0.8 && Math.abs(game.vehicle.speed) > 0.5 && Math.random() < 0.5) {
        const v = game.vehicle;
        const s = Math.sin(v.heading);
        const c = Math.cos(v.heading);
        const side = Math.random() < 0.5 ? -1 : 1;
        const lx = side * (game.stats.brushWidth / 2 - 0.3);
        pools.dust.spawn(v.x + c * lx + s * 3.4, 0.15, v.z - s * lx + c * 3.4, c * side * 1.5, 0.8, -s * side * 1.5, 0.35, 0.03, '#b9c2c9');
      }
    }
    pools.dust.update(dt);
    pools.foam.update(dt);
    pools.spark.update(dt);
  });

  return (
    <>
      <primitive object={pools.dust.mesh} />
      <primitive object={pools.foam.mesh} />
      <primitive object={pools.spark.mesh} />
    </>
  );
}
