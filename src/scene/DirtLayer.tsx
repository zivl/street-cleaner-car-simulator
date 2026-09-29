import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Game } from '../game/Game';
import { CELL, ITEM_BOTTLE, ITEM_BOX, ITEM_CAN, ITEM_KINDS, ITEM_LEAF, ITEM_PAPER, ITEM_PILE } from '../game/CleaningSystem';
import { G, mergeParts } from './geometry';
import { grimeNoiseTexture } from './textures';

/**
 * Road dirt overlay: a transparent plane over the whole map whose shader samples
 * the cleaning grid (DataTexture). Lit by the scene through MeshStandardMaterial.
 */
function DirtOverlay({ game }: { game: Game }) {
  const C = game.cleaning;
  const { mesh, tex, material } = useMemo(() => {
    const tex = new THREE.DataTexture(C.tex, C.gw, C.gh, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    const noise = grimeNoiseTexture();
    const material = new THREE.MeshStandardMaterial({
      transparent: true,
      depthWrite: false,
      roughness: 0.9,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const uniforms = {
      uDirt: { value: tex },
      uNoise: { value: noise },
      uMapSize: { value: new THREE.Vector2(C.gw * CELL, C.gh * CELL) },
      uTime: { value: 0 },
    };
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vDirtXZ;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDirtXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform sampler2D uDirt;
uniform sampler2D uNoise;
uniform vec2 uMapSize;
uniform float uTime;
varying vec2 vDirtXZ;
float gDirtRough = 0.9;
float gDirtMetal = 0.0;`,
        )
        .replace(
          '#include <map_fragment>',
          `
vec2 duv = vDirtXZ / uMapSize;
vec4 dcell = texture2D(uDirt, duv);
vec4 nz = texture2D(uNoise, vDirtXZ * 0.11);
vec4 nz2 = texture2D(uNoise, vDirtXZ * 0.37 + 0.5);
float amt = dcell.r;
float t = dcell.g;
float foam = dcell.b;
float road = dcell.a;
float grain = nz.r * 0.65 + nz2.r * 0.55;
float dirtA = smoothstep(0.14, 0.6, amt * (0.5 + grain)) * 0.88;
vec3 leafC = mix(vec3(0.30, 0.21, 0.09), vec3(0.47, 0.33, 0.13), nz2.g);
vec3 oilC = vec3(0.025, 0.022, 0.03) + 0.05 * vec3(sin(nz.g * 12.0 + 1.0), sin(nz.g * 12.0 + 3.0), sin(nz.g * 12.0 + 5.0)) * 0.5;
vec3 trashC = mix(vec3(0.30, 0.28, 0.24), vec3(0.42, 0.38, 0.30), nz2.g);
float wOil = 1.0 - abs(t - 0.5) * 2.0;
float wLeaf = clamp(1.0 - t * 2.0, 0.0, 1.0);
float wTrash = clamp(t * 2.0 - 1.0, 0.0, 1.0);
vec3 dirtC = leafC * wLeaf + oilC * wOil + trashC * wTrash;
float oilBoost = wOil * smoothstep(0.1, 0.35, amt);
dirtA = max(dirtA, oilBoost * 0.92);
float foamA = foam * smoothstep(0.35, 0.75, nz2.b * 0.6 + nz.r * 0.6 + foam * 0.3);
vec3 col = mix(dirtC, vec3(0.96, 0.97, 1.0), foamA);
float alpha = max(dirtA, foamA * 0.95) * road;
if (alpha < 0.01) discard;
diffuseColor = vec4(col, alpha);
gDirtRough = mix(0.95, 0.12, wOil * dirtA);
gDirtRough = mix(gDirtRough, 0.4, foamA);
gDirtMetal = wOil * dirtA * 0.35;
`,
        )
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = gDirtRough;')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = gDirtMetal;');
    };
    const W = C.gw * CELL;
    const H = C.gh * CELL;
    const geo = new THREE.PlaneGeometry(W, H);
    geo.rotateX(-Math.PI / 2);
    geo.translate(W / 2, 0.025, H / 2);
    const mesh = new THREE.Mesh(geo, material);
    mesh.renderOrder = 1;
    mesh.receiveShadow = true;
    return { mesh, tex, material };
  }, [C]);

  useEffect(
    () => () => {
      mesh.geometry.dispose();
      material.dispose();
      tex.dispose();
    },
    [mesh, material, tex],
  );

  const lastVersion = useRef(-1);
  const lastUpload = useRef(0);
  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (C.texVersion !== lastVersion.current && now - lastUpload.current > 1 / 30) {
      lastVersion.current = C.texVersion;
      lastUpload.current = now;
      tex.needsUpdate = true;
    }
  });

  return <primitive object={mesh} />;
}

const LEAF_COLORS = ['#c9791e', '#d9a027', '#a8541b', '#e3b43b', '#8f4a1c', '#b8862b', '#cf5f22', '#9a6b2a'];
const BOTTLE_COLORS = ['#2f7d4a', '#8fbf9f', '#6b3f1d', '#cfe8f0', '#2f7d4a', '#3b6fa0', '#8fbf9f', '#6b3f1d'];
const CAN_COLORS = ['#d62828', '#c0c7cf', '#1d4ed8', '#16a34a', '#f59e0b', '#d62828', '#6d28d9', '#c0c7cf'];
const PAPER_COLORS = ['#f4f1ea', '#e8e2d0', '#ffffff', '#f7e6c4', '#dfe7ef', '#f4f1ea', '#ffffff', '#efe3cf'];
const BOX_COLORS = ['#b08a5a', '#a07a4a', '#c49a66', '#9a7448', '#b08a5a', '#c49a66', '#a07a4a', '#8f6a40'];

function itemGeometry(kind: number): THREE.BufferGeometry {
  switch (kind) {
    case ITEM_LEAF: {
      const g = new THREE.BufferGeometry();
      // Diamond-shaped leaf with a slight fold.
      const v = new Float32Array([0, 0.02, -0.14, 0.07, 0.035, 0, 0, 0.02, 0.14, 0, 0.02, -0.14, 0, 0.02, 0.14, -0.07, 0.035, 0]);
      g.setAttribute('position', new THREE.BufferAttribute(v, 3));
      g.computeVertexNormals();
      const n = g.attributes.normal as THREE.BufferAttribute;
      for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
      return mergeParts([{ geo: g, color: '#ffffff' }]);
    }
    case ITEM_PILE:
      return mergeParts([
        { geo: G.sphere(0.45, 1), color: '#ffffff', scale: [1.2, 0.35, 1], position: [0, 0.05, 0] },
        { geo: G.sphere(0.3, 1), color: '#dddddd', scale: [1, 0.4, 1.2], position: [0.35, 0.05, 0.2] },
      ]);
    case ITEM_BOTTLE:
      return mergeParts([
        { geo: G.cyl(0.05, 0.05, 0.2, 8), color: '#ffffff', rotation: [0, 0, Math.PI / 2], position: [0, 0.05, 0] },
        { geo: G.cyl(0.02, 0.045, 0.1, 8), color: '#ffffff', rotation: [0, 0, Math.PI / 2], position: [0.14, 0.05, 0] },
      ]);
    case ITEM_CAN:
      return mergeParts([{ geo: G.cyl(0.04, 0.04, 0.13, 10), color: '#ffffff', rotation: [0, 0, Math.PI / 2], position: [0, 0.04, 0] }]);
    case ITEM_PAPER:
      return mergeParts([{ geo: G.sphere(0.09, 0), color: '#ffffff', scale: [1.2, 0.7, 1], position: [0, 0.05, 0] }]);
    case ITEM_BOX:
    default:
      return mergeParts([
        { geo: G.box(0.4, 0.25, 0.3), color: '#ffffff', position: [0, 0.125, 0] },
        { geo: G.box(0.1, 0.01, 0.31), color: '#d8c8a8', position: [0, 0.255, 0] },
      ]);
  }
}

function paletteFor(kind: number) {
  switch (kind) {
    case ITEM_LEAF:
    case ITEM_PILE:
      return LEAF_COLORS;
    case ITEM_BOTTLE:
      return BOTTLE_COLORS;
    case ITEM_CAN:
      return CAN_COLORS;
    case ITEM_PAPER:
      return PAPER_COLORS;
    default:
      return BOX_COLORS;
  }
}

interface Absorb {
  kind: number;
  inst: number;
  t: number;
  x: number;
  z: number;
  rot: number;
  scale: number;
}

/** Instanced leaves, piles and trash. Items get sucked toward the truck when cleaned. */
function DirtItems({ game }: { game: Game }) {
  const C = game.cleaning;
  const { meshes, instanceOf, materials } = useMemo(() => {
    const byKind: number[][] = Array.from({ length: ITEM_KINDS }, () => []);
    const instanceOf = new Int32Array(C.items.length);
    C.items.forEach((it, i) => {
      instanceOf[i] = byKind[it.kind].length;
      byKind[it.kind].push(i);
    });
    const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
    const trashMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 });
    const materials = [leafMat, trashMat];
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const meshes = byKind.map((list, kind) => {
      const m = new THREE.InstancedMesh(itemGeometry(kind), kind <= ITEM_PILE ? leafMat : trashMat, Math.max(1, list.length));
      m.count = list.length;
      const pal = paletteFor(kind);
      list.forEach((idx, i) => {
        const it = C.items[idx];
        dummy.position.set(it.x, 0.03, it.z);
        dummy.rotation.set(kind === ITEM_LEAF ? (it.variant - 3.5) * 0.08 : 0, it.rot, 0);
        dummy.scale.setScalar(it.scale);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        col.set(pal[it.variant % pal.length]);
        m.setColorAt(i, col);
      });
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.frustumCulled = false;
      m.castShadow = kind === ITEM_BOX || kind === ITEM_PILE;
      m.receiveShadow = true;
      return m;
    });
    return { meshes, instanceOf, materials };
  }, [C]);

  useEffect(
    () => () => {
      meshes.forEach((m) => m.geometry.dispose());
      materials.forEach((m) => m.dispose());
    },
    [meshes, materials],
  );

  const absorbing = useRef<Absorb[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const hidden = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), []);

  useFrame((_, dt) => {
    const removed = C.removed;
    if (removed.length) {
      for (const idx of removed) {
        const it = C.items[idx];
        absorbing.current.push({ kind: it.kind, inst: instanceOf[idx], t: 0, x: it.x, z: it.z, rot: it.rot, scale: it.scale });
      }
      removed.length = 0;
    }
    const list = absorbing.current;
    if (!list.length) return;
    const v = game.vehicle;
    const s = Math.sin(v.heading);
    const c = Math.cos(v.heading);
    // Suction point under the truck, just behind the front brooms.
    const tx = v.x + s * 1.2;
    const tz = v.z + c * 1.2;
    const dirty = new Set<number>();
    let w = 0;
    for (let k = 0; k < list.length; k++) {
      const a = list[k];
      a.t += dt / 0.35;
      const mesh = meshes[a.kind];
      dirty.add(a.kind);
      if (a.t >= 1) {
        mesh.setMatrixAt(a.inst, hidden);
        continue;
      }
      const e = a.t * a.t;
      dummy.position.set(a.x + (tx - a.x) * e, 0.03 + Math.sin(a.t * Math.PI) * 0.6, a.z + (tz - a.z) * e);
      dummy.rotation.set(a.t * 6, a.rot + a.t * 10, 0);
      dummy.scale.setScalar(a.scale * (1 - e * 0.8));
      dummy.updateMatrix();
      mesh.setMatrixAt(a.inst, dummy.matrix);
      list[w++] = a;
    }
    list.length = w;
    dirty.forEach((k) => (meshes[k].instanceMatrix.needsUpdate = true));
  });

  return (
    <group>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  );
}

export function DirtLayer({ game }: { game: Game }) {
  return (
    <>
      <DirtOverlay game={game} />
      <DirtItems game={game} />
    </>
  );
}
