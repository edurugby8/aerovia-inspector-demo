// Rolling terrain around the inspected turbine, its crane pad and access track, and the
// distant wind farm. Deterministic, so every build draws the same place.
import * as THREE from 'three';
import { noise2, remap, rng, smoothstep } from '../math';

const n = noise2(3);
const raw = (x: number, z: number) => 34 * n(x / 1400 + 3.1, z / 1400 - 1.7, 4) + 9 * n(x / 330, z / 330, 3);
const RAW0 = raw(0, 0);

/** Ground height (m). The tower stands at y = 0 on a levelled site; hills rise in the distance. */
export function terrainHeight(x: number, z: number) {
  const d = Math.hypot(x, z);
  const site = smoothstep(remap(d, 60, 260));
  const far = smoothstep(remap(d, 1400, 4200)) * (70 + 60 * n(x / 2600 + 9, z / 2600 - 4, 2));
  return (raw(x, z) - RAW0) * site - 4 * site + far;
}

export function buildTerrain({ size = 12000, segments = 320 } = {}) {
  const g = new THREE.PlaneGeometry(size, size, segments, segments);
  g.rotateX(-Math.PI / 2);
  // denser near the site: pull vertices towards the centre
  const P = g.getAttribute('position');
  const colors = new Float32Array(P.count * 3);
  const half = size / 2;
  for (let i = 0; i < P.count; i++) {
    const ux = P.getX(i) / half, uz = P.getZ(i) / half;
    const k = (u: number) => Math.sign(u) * Math.abs(u) ** 1.9 * half;
    const x = k(ux), z = k(uz);
    const y = terrainHeight(x, z);
    P.setXYZ(i, x, y, z);
    // dusk grass: dark olive with drier patches and darker hollows
    const dry = 0.5 + 0.5 * n(x / 180 + 40, z / 180 - 11, 3);
    const hollow = Math.max(0, -n(x / 600, z / 600, 2));
    const c = new THREE.Color().setRGB(0.07 + 0.05 * dry - 0.02 * hollow, 0.095 + 0.04 * dry - 0.025 * hollow, 0.075 + 0.015 * dry - 0.02 * hollow);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

/** Gravel crane pad beside the tower and the access track, draped on the terrain. */
export function buildSiteGeometry() {
  const pad = new THREE.PlaneGeometry(46, 26, 23, 13);
  pad.rotateX(-Math.PI / 2);
  pad.translate(30, 0, -4);
  const Pp = pad.getAttribute('position');
  for (let i = 0; i < Pp.count; i++) Pp.setY(i, terrainHeight(Pp.getX(i), Pp.getZ(i)) + 0.12);
  pad.computeVertexNormals();
  // track: a ribbon along a gentle curve leaving the pad
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(52, 0, -4), new THREE.Vector3(140, 0, 30), new THREE.Vector3(260, 0, 140), new THREE.Vector3(330, 0, 330), new THREE.Vector3(360, 0, 620)]);
  const pts = curve.getSpacedPoints(160);
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const t = new THREE.Vector3().subVectors(b, a).setY(0).normalize();
    const side = new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(2.6);
    for (const s of [-1, 1]) {
      const x = pts[i].x + side.x * s, z = pts[i].z + side.z * s;
      pos.push(x, terrainHeight(x, z) + 0.1, z);
    }
    if (i < pts.length - 1) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const track = new THREE.BufferGeometry();
  track.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  track.setIndex(idx);
  track.computeVertexNormals();
  return { pad, track };
}

/**
 * Distant ridges on the horizon: a closed band of hills at a given radius, its crest
 * shaped by noise. Fog blends it into the sky, so two bands read as layered mountains.
 */
export function buildRidge(radius: number, height: number, seed: number, segments = 360) {
  const rn = noise2(seed);
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2, x = Math.sin(a), z = Math.cos(a);
    const crest = height * (0.45 + 0.55 * (rn(x * 2.2 + 5, z * 2.2 - 3, 4) * 0.5 + 0.5)) * (0.6 + 0.4 * Math.abs(Math.sin(a * 1.5 + seed)));
    pos.push(x * radius, -40, z * radius, x * radius, crest, z * radius);
    if (i < segments) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export type FarmTurbine = { x: number; y: number; z: number; scale: number; phase: number; rpm: number };

/** The distant wind farm: two rows on the ridge behind the site and a group to the east, all facing the wind (+z). */
export function windFarm(): FarmTurbine[] {
  const r = rng(11);
  // placed so that none stands right behind the drone in the presentation shot
  const spots: [number, number][] = [
    [-1450, -860], [-1080, -820], [-820, -700], [-300, -900], [210, -880], [600, -830], [980, -900],
    [-1900, -1650], [-1450, -1600], [-1300, -1500], [-550, -1640], [-100, -1720], [350, -1660], [800, -1700], [1250, -1640],
    [1250, -160], [1480, 260], [1700, 680],
  ];
  return spots.map(([x, z]) => {
    const jx = x + (r() - 0.5) * 60, jz = z + (r() - 0.5) * 60;
    return { x: jx, y: terrainHeight(jx, jz), z: jz, scale: 0.92 + r() * 0.14, phase: r() * Math.PI * 2, rpm: 11 + r() * 3 };
  });
}
