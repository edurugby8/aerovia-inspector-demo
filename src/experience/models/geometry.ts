// Geometry helpers shared by the models. Pure three.js, no DOM.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type Section = { z: number; w: number; h: number; y?: number; x?: number; n?: number };

/**
 * Squircle cross-sections (|x|^n + |y|^n = 1) lofted along z, capped at both ends:
 * housings with soft, engineered edges. Sections may run in either z direction.
 */
export function loftSquircle(sections: Section[], ring = 48) {
  const pos: number[] = [];
  const L = ring + 1;
  for (const s of sections) {
    const n = s.n ?? 5;
    for (let i = 0; i <= ring; i++) {
      const t = (i / ring) * Math.PI * 2, c = Math.cos(t), si = Math.sin(t);
      pos.push((s.x ?? 0) + (s.w / 2) * Math.sign(c) * Math.abs(c) ** (2 / n), (s.y ?? 0) + (s.h / 2) * Math.sign(si) * Math.abs(si) ** (2 / n), s.z);
    }
  }
  const forward = sections[sections.length - 1].z < sections[0].z; // front (+z) to rear
  const idx: number[] = [];
  for (let k = 0; k < sections.length - 1; k++) for (let i = 0; i < ring; i++) {
    const a = k * L + i, b = a + 1, c = a + L, d = c + 1;
    if (forward) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  for (const [k, first] of [[0, true], [sections.length - 1, false]] as const) {
    const s = sections[k], centre = pos.length / 3;
    pos.push(s.x ?? 0, s.y ?? 0, s.z);
    const facesPlusZ = first === forward;
    for (let i = 0; i < ring; i++) {
      const a = k * L + i, b = a + 1;
      if (facesPlusZ) idx.push(centre, a, b); else idx.push(centre, b, a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // planar uv (x, z) so textured materials have something sensible
  const uv = new Float32Array((pos.length / 3) * 2);
  for (let i = 0; i < pos.length / 3; i++) { uv[i * 2] = pos[i * 3] * 4; uv[i * 2 + 1] = pos[i * 3 + 2] * 4; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

const _up = new THREE.Vector3(0, 1, 0);
/** A cylinder from a to b. */
export function tube(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 16, r2 = r) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r2, r, len, seg, 1);
  const dir = b.clone().sub(a).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(_up, dir);
  g.applyQuaternion(q);
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

/** Cylinder with its axis along y, sitting between y0 and y0 + h. */
export function cylinderY(r: number, h: number, y0 = 0, seg = 32, rTop = r) {
  const g = new THREE.CylinderGeometry(rTop, r, h, seg);
  g.translate(0, y0 + h / 2, 0);
  return g;
}

/** Revolve a (radius, y) profile around y. */
export function lathe(profile: [number, number][], seg = 48) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)), seg);
}

/** Merge parts that may or may not be indexed; keeps position, normal and uv. */
export function merge(parts: THREE.BufferGeometry[]) {
  const ready = parts.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    if (!n.getAttribute('normal')) n.computeVertexNormals();
    if (!n.getAttribute('uv')) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n.getAttribute('position').count * 2), 2));
    for (const name of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(name)) n.deleteAttribute(name);
    return n;
  });
  const out = mergeGeometries(ready, false);
  if (!out) throw new Error('merge failed');
  return out;
}

export const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
