import * as THREE from 'three';
import type { CityConfig, PropKind, TreeStyle } from '../data/cities';
import { G, mergeParts, type Part } from './geometry';

const PI = Math.PI;

export function lampGeometry(style: CityConfig['lampStyle']) {
  const pole = '#2d3136';
  if (style === 'classic') {
    return {
      body: mergeParts([
        { geo: G.cyl(0.14, 0.2, 0.6, 8), color: pole, position: [0, 0.3, 0] },
        { geo: G.cyl(0.07, 0.09, 4.2, 8), color: pole, position: [0, 2.6, 0] },
        { geo: G.cyl(0.26, 0.12, 0.25, 6), color: pole, position: [0, 4.75, 0] },
        { geo: G.cone(0.3, 0.3, 6), color: pole, position: [0, 5.45, 0] },
      ]),
      bulb: mergeParts([{ geo: G.cyl(0.2, 0.15, 0.5, 6), color: '#ffffff', position: [0, 5.1, 0] }]),
      bulbHeight: 5.1,
      bulbOffset: 0,
    };
  }
  if (style === 'lantern') {
    return {
      body: mergeParts([
        { geo: G.cyl(0.12, 0.18, 0.8, 8), color: '#1f2a24', position: [0, 0.4, 0] },
        { geo: G.cyl(0.06, 0.08, 3.6, 8), color: '#1f2a24', position: [0, 2.5, 0] },
        { geo: G.box(1.4, 0.06, 0.06), color: '#1f2a24', position: [0, 4.2, 0] },
        { geo: G.cone(0.22, 0.25, 4), color: '#1f2a24', position: [0.62, 4.85, 0], rotation: [0, PI / 4, 0] },
        { geo: G.cone(0.22, 0.25, 4), color: '#1f2a24', position: [-0.62, 4.85, 0], rotation: [0, PI / 4, 0] },
      ]),
      bulb: mergeParts([
        { geo: G.box(0.28, 0.4, 0.28), color: '#ffffff', position: [0.62, 4.5, 0] },
        { geo: G.box(0.28, 0.4, 0.28), color: '#ffffff', position: [-0.62, 4.5, 0] },
      ]),
      bulbHeight: 4.5,
      bulbOffset: 0,
    };
  }
  // modern: tall pole with an arm reaching over the road (+z local)
  return {
    body: mergeParts([
      { geo: G.cyl(0.08, 0.13, 7, 8), color: '#5b6068', position: [0, 3.5, 0] },
      { geo: G.box(0.1, 0.1, 2.2), color: '#5b6068', position: [0, 6.95, 1.05] },
      { geo: G.box(0.34, 0.12, 0.8), color: '#3a3e44', position: [0, 6.92, 2.15] },
    ]),
    bulb: mergeParts([{ geo: G.box(0.28, 0.05, 0.7), color: '#ffffff', position: [0, 6.84, 2.15] }]),
    bulbHeight: 6.8,
    bulbOffset: 2.15,
  };
}

export function treeGeometry(style: TreeStyle) {
  const trunk = '#5a4130';
  switch (style) {
    case 'palm': {
      const parts: Part[] = [
        { geo: G.cyl(0.14, 0.24, 7, 7), color: '#8a6a4a', position: [0, 3.5, 0], rotation: [0.06, 0, 0.04] },
        { geo: G.sphere(0.35, 0), color: '#6b4d2e', position: [0.2, 7, 0.3] },
      ];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * PI * 2;
        parts.push({
          geo: G.cone(0.5, 3.4, 4),
          color: i % 2 ? '#3f7d2f' : '#4f9a37',
          position: [0.2 + Math.sin(a) * 1.5, 6.6, 0.3 + Math.cos(a) * 1.5],
          rotation: [Math.cos(a) * 1.9, 0, -Math.sin(a) * 1.9],
          scale: [1, 1, 0.18],
        });
      }
      return mergeParts(parts);
    }
    case 'cone':
      return mergeParts([
        { geo: G.cyl(0.14, 0.2, 1.6, 6), color: trunk, position: [0, 0.8, 0] },
        { geo: G.cone(1.7, 3.2, 8), color: '#2f6b35', position: [0, 3.0, 0] },
        { geo: G.cone(1.3, 2.6, 8), color: '#367a3c', position: [0, 4.4, 0] },
        { geo: G.cone(0.8, 2.0, 8), color: '#3f8a45', position: [0, 5.6, 0] },
      ]);
    case 'blossom':
      return mergeParts([
        { geo: G.cyl(0.14, 0.22, 2.6, 6), color: '#4a3226', position: [0, 1.3, 0] },
        { geo: G.sphere(1.7, 1), color: '#f7b6cf', position: [0, 3.6, 0], scale: [1.2, 0.8, 1.1] },
        { geo: G.sphere(1.2, 1), color: '#fbc9dc', position: [0.9, 3.9, 0.4] },
        { geo: G.sphere(1.1, 1), color: '#f39fc0', position: [-0.8, 3.7, -0.3] },
      ]);
    default:
      return mergeParts([
        { geo: G.cyl(0.15, 0.24, 2.8, 6), color: trunk, position: [0, 1.4, 0] },
        { geo: G.sphere(1.9, 1), color: '#4f8a3a', position: [0, 4.1, 0], scale: [1, 0.95, 1] },
        { geo: G.sphere(1.3, 1), color: '#5d9a43', position: [0.9, 4.6, 0.5] },
        { geo: G.sphere(1.2, 1), color: '#467d33', position: [-0.8, 4.4, -0.5] },
      ]);
  }
}

export function propGeometry(kind: PropKind): THREE.BufferGeometry {
  switch (kind) {
    case 'bench':
      return mergeParts([
        { geo: G.box(1.8, 0.08, 0.5), color: '#8a5a33', position: [0, 0.48, 0] },
        { geo: G.box(1.8, 0.45, 0.07), color: '#8a5a33', position: [0, 0.8, -0.24], rotation: [-0.15, 0, 0] },
        { geo: G.box(0.08, 0.48, 0.5), color: '#2b2b2b', position: [-0.8, 0.24, 0] },
        { geo: G.box(0.08, 0.48, 0.5), color: '#2b2b2b', position: [0.8, 0.24, 0] },
      ]);
    case 'bin':
      return mergeParts([
        { geo: G.cyl(0.32, 0.28, 0.95, 10), color: '#2f5d3a', position: [0, 0.48, 0] },
        { geo: G.cyl(0.35, 0.35, 0.08, 10), color: '#1f2f24', position: [0, 0.98, 0] },
      ]);
    case 'hydrant':
      return mergeParts([
        { geo: G.cyl(0.16, 0.2, 0.7, 8), color: '#c4262e', position: [0, 0.35, 0] },
        { geo: G.sphere(0.17, 1), color: '#c4262e', position: [0, 0.72, 0] },
        { geo: G.cyl(0.07, 0.07, 0.5, 6), color: '#a01d24', position: [0, 0.5, 0], rotation: [0, 0, PI / 2] },
      ]);
    case 'phonebox':
      return mergeParts([
        { geo: G.box(1.0, 2.5, 1.0), color: '#c8102e', position: [0, 1.25, 0] },
        { geo: G.box(0.8, 1.6, 1.02), color: '#2a3440', position: [0, 1.35, 0] },
        { geo: G.box(1.02, 1.6, 0.8), color: '#2a3440', position: [0, 1.35, 0] },
        { geo: G.box(1.1, 0.2, 1.1), color: '#c8102e', position: [0, 2.6, 0] },
      ]);
    case 'vending':
      return mergeParts([
        { geo: G.box(1.0, 1.9, 0.8), color: '#e8e8ea', position: [0, 0.95, 0] },
        { geo: G.box(0.85, 1.1, 0.05), color: '#8fd3ff', position: [0, 1.25, 0.41] },
        { geo: G.box(0.85, 0.25, 0.05), color: '#e0245e', position: [0, 0.35, 0.41] },
      ]);
    case 'kiosk':
      return mergeParts([
        { geo: G.cyl(1.0, 1.0, 2.4, 10), color: '#2f5d4a', position: [0, 1.2, 0] },
        { geo: G.cone(1.25, 0.8, 10), color: '#1f3d31', position: [0, 2.8, 0] },
        { geo: G.cyl(1.02, 1.02, 0.9, 10), color: '#e9d8a6', position: [0, 1.75, 0] },
      ]);
    case 'bollard':
      return mergeParts([
        { geo: G.cyl(0.1, 0.12, 0.9, 8), color: '#2b2d31', position: [0, 0.45, 0] },
        { geo: G.cyl(0.11, 0.11, 0.08, 8), color: '#d8d8d8', position: [0, 0.75, 0] },
      ]);
    case 'planter':
      return mergeParts([
        { geo: G.box(1.0, 0.6, 1.0), color: '#8f8a80', position: [0, 0.3, 0] },
        { geo: G.sphere(0.55, 1), color: '#4f8a3a', position: [0, 0.85, 0], scale: [1, 0.7, 1] },
      ]);
  }
}

/** Car geometry facing +z. Body is white so instanceColor tints it. */
export function carGeometry() {
  const glass = '#1d2733';
  const dark = '#151515';
  return mergeParts([
    { geo: G.box(1.8, 0.7, 4.3), color: '#ffffff', position: [0, 0.65, 0] },
    { geo: G.box(1.6, 0.6, 2.3), color: '#ffffff', position: [0, 1.28, -0.2] },
    { geo: G.box(1.62, 0.5, 2.1), color: glass, position: [0, 1.28, -0.2] },
    { geo: G.box(1.5, 0.5, 2.34), color: glass, position: [0, 1.28, -0.2] },
    { geo: G.cyl(0.36, 0.36, 0.3, 10), color: dark, position: [0.82, 0.36, 1.35], rotation: [0, 0, PI / 2] },
    { geo: G.cyl(0.36, 0.36, 0.3, 10), color: dark, position: [-0.82, 0.36, 1.35], rotation: [0, 0, PI / 2] },
    { geo: G.cyl(0.36, 0.36, 0.3, 10), color: dark, position: [0.82, 0.36, -1.35], rotation: [0, 0, PI / 2] },
    { geo: G.cyl(0.36, 0.36, 0.3, 10), color: dark, position: [-0.82, 0.36, -1.35], rotation: [0, 0, PI / 2] },
    { geo: G.box(1.7, 0.2, 0.1), color: '#2a2a2a', position: [0, 0.45, 2.16] },
    { geo: G.box(1.7, 0.2, 0.1), color: '#2a2a2a', position: [0, 0.45, -2.16] },
  ]);
}

export function carLightsGeometry() {
  return mergeParts([
    { geo: G.box(0.4, 0.14, 0.06), color: '#fff6d6', position: [0.6, 0.78, 2.16] },
    { geo: G.box(0.4, 0.14, 0.06), color: '#fff6d6', position: [-0.6, 0.78, 2.16] },
    { geo: G.box(0.4, 0.14, 0.06), color: '#ff2020', position: [0.62, 0.8, -2.16] },
    { geo: G.box(0.4, 0.14, 0.06), color: '#ff2020', position: [-0.62, 0.8, -2.16] },
  ]);
}

export function busGeometry() {
  const glass = '#1d2733';
  const dark = '#151515';
  return mergeParts([
    { geo: G.box(2.5, 2.6, 10), color: '#ffffff', position: [0, 1.75, 0] },
    { geo: G.box(2.52, 0.8, 9.2), color: glass, position: [0, 2.2, 0.2] },
    { geo: G.box(2.4, 0.9, 0.05), color: glass, position: [0, 2.2, 5.0] },
    { geo: G.cyl(0.5, 0.5, 0.3, 10), color: dark, position: [1.15, 0.5, 3.5], rotation: [0, 0, PI / 2] },
    { geo: G.cyl(0.5, 0.5, 0.3, 10), color: dark, position: [-1.15, 0.5, 3.5], rotation: [0, 0, PI / 2] },
    { geo: G.cyl(0.5, 0.5, 0.3, 10), color: dark, position: [1.15, 0.5, -3.3], rotation: [0, 0, PI / 2] },
    { geo: G.cyl(0.5, 0.5, 0.3, 10), color: dark, position: [-1.15, 0.5, -3.3], rotation: [0, 0, PI / 2] },
  ]);
}

export function coneGeometry() {
  return mergeParts([
    { geo: G.box(0.5, 0.05, 0.5), color: '#222', position: [0, 0.025, 0] },
    { geo: G.cone(0.2, 0.7, 10), color: '#ff6a00', position: [0, 0.4, 0] },
    { geo: G.cyl(0.13, 0.15, 0.1, 10), color: '#ffffff', position: [0, 0.45, 0] },
  ]);
}

export function barrierGeometry() {
  return mergeParts([
    { geo: G.box(1.9, 0.3, 0.08), color: '#ffffff', position: [0, 0.9, 0] },
    { geo: G.box(0.5, 0.31, 0.09), color: '#e11d2a', position: [-0.6, 0.9, 0] },
    { geo: G.box(0.5, 0.31, 0.09), color: '#e11d2a', position: [0.4, 0.9, 0] },
    { geo: G.box(0.08, 0.9, 0.08), color: '#444', position: [-0.85, 0.45, 0] },
    { geo: G.box(0.08, 0.9, 0.08), color: '#444', position: [0.85, 0.45, 0] },
    { geo: G.box(0.5, 0.06, 0.5), color: '#333', position: [-0.85, 0.03, 0] },
    { geo: G.box(0.5, 0.06, 0.5), color: '#333', position: [0.85, 0.03, 0] },
    { geo: G.sphere(0.07, 0), color: '#ffb300', position: [0, 1.15, 0] },
  ]);
}
