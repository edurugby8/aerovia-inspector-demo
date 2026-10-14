// A generic onshore wind turbine at real scale (metres): 100 m hub height, 120 m rotor,
// 58 m blades with a round root, cambered airfoils, twist, a flatback trailing edge
// near the root, pre-bend, 2.5° cone and a 5° tilted rotor axis. Pure three.js, no DOM,
// so the trajectory tests measure clearances against exactly this geometry.
//
// Frames
//   world   y up; tower axis on the y axis; the rotor faces +z (upwind).
//   rotor   origin at the hub centre, +z along the rotor axis (upwind), +y up at azimuth 0.
//   blade   +x along the span (from the hub), +z upwind, +y = z × x. The rotor turns
//           clockwise seen from upwind, so each section's leading edge faces −y.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { deg, smoothstep, table } from '../math';
import { lathe, loftSquircle, merge } from './geometry';

export const TURBINE = {
  hubHeight: 100,
  towerTop: 97.6,
  hubZ: 4.8, // overhang: hub centre in front of the tower axis
  tilt: deg(5), // rotor axis tilted up
  cone: deg(2.5), // blades leaning upwind
  rootR: 2.0,
  tipR: 60,
  parkedPitch: deg(86), // a stopped turbine keeps its blades feathered
  azimuth: { A: 30, B: 270, C: 150 }, // degrees, clockwise from 12 o'clock seen from upwind
} as const;
export type BladeId = keyof typeof TURBINE.azimuth;
export const BLADES: BladeId[] = ['A', 'B', 'C'];

// ------------------------------------------------------------------ blade planform
// radius from the hub centre (m) → value
const chord = table([[2.0, 2.3], [3.5, 2.32], [6, 2.85], [9, 3.65], [12.5, 4.15], [16, 4.0], [22, 3.5], [30, 2.92], [40, 2.28], [50, 1.68], [55, 1.32], [58.2, 0.98], [59.4, 0.62], [60, 0.04]]);
const thick = table([[2, 1], [3.5, 1], [6, 0.8], [9, 0.54], [12.5, 0.4], [16, 0.33], [22, 0.27], [30, 0.225], [40, 0.195], [50, 0.175], [60, 0.16]]);
const twistDeg = table([[2, 13.5], [12.5, 13], [20, 8.8], [30, 5.2], [40, 2.6], [50, 0.8], [60, -0.4]]);
const flatback = table([[2, 0], [5, 0], [8, 0.1], [12.5, 0.075], [20, 0.025], [30, 0.006], [60, 0.004]]);
const pitchAxis = table([[2, 0.5], [6, 0.42], [12.5, 0.32], [60, 0.3]]);
/** 1 = round root, 0 = airfoil. */
const roundness = (r: number) => 1 - smoothstep((r - 3.2) / (11 - 3.2));
/** Tip bent upwind so it clears the tower; zero inboard of 20 m. */
export const prebend = (r: number) => (r < 20 ? 0 : 2.2 * ((r - 20) / 40) ** 2);
export const bladeChord = chord;

const CAMBER = 0.025, CAMBER_AT = 0.4;
function camberLine(x: number) {
  if (x < CAMBER_AT) return [(CAMBER / CAMBER_AT ** 2) * (2 * CAMBER_AT * x - x * x), (2 * CAMBER / CAMBER_AT ** 2) * (CAMBER_AT - x)];
  const k = CAMBER / (1 - CAMBER_AT) ** 2;
  return [k * (1 - 2 * CAMBER_AT + 2 * CAMBER_AT * x - x * x), 2 * k * (CAMBER_AT - x)];
}
const halfThickness = (x: number, t: number, te: number) =>
  5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4) + 0.5 * te * x ** 3;

/**
 * Point on the section at radius r, loop parameter q ∈ [0, 1]: 0 = trailing edge on the
 * suction side, 0.5 = leading edge, 1 = trailing edge on the pressure side. Returns the
 * blade-frame (y, z) after twist and pre-bend.
 */
export function sectionPoint(r: number, q: number, out: [number, number] = [0, 0]): [number, number] {
  const c = chord(r), t = thick(r), te = flatback(r), a = pitchAxis(r), k = roundness(r);
  const upper = q <= 0.5;
  const beta = upper ? Math.PI * (1 - q * 2) : Math.PI * (q * 2 - 1);
  const x = (1 - Math.cos(beta)) / 2;
  const [yc, dyc] = camberLine(x);
  const yt = halfThickness(x, Math.min(t, 0.6), te);
  const th = Math.atan(dyc);
  const ax = upper ? x - yt * Math.sin(th) : x + yt * Math.sin(th);
  const ay = upper ? yc + yt * Math.cos(th) : yc - yt * Math.cos(th);
  let s = (ax - a) * c, v = ay * c;
  if (k > 0) {
    // the round root: a circle of the local thickness, centred on the pitch axis
    const R = 0.5 * c * t, phi = upper ? Math.PI - beta : Math.PI + beta;
    s = s + (R * Math.cos(phi) - s) * k;
    v = v + (R * Math.sin(phi) - v) * k;
  }
  // chord along +y with the leading edge at −y; suction side faces −z (downwind)
  const Y = s, Z = -v, th2 = deg(twistDeg(r));
  out[0] = Y * Math.cos(th2) + Z * Math.sin(th2);
  out[1] = -Y * Math.sin(th2) + Z * Math.cos(th2) + prebend(r);
  return out;
}

/** Span stations: dense where the shape changes (root transition, tip). */
export function bladeStations(scale = 1) {
  const out: number[] = [];
  const add = (from: number, to: number, step: number) => { for (let r = from; r < to - 1e-6; r += step / scale) out.push(r); };
  add(2, 4.5, 0.25); add(4.5, 14, 0.5); add(14, 56, 1.0); add(56, 59.5, 0.25); add(59.5, 60, 0.1);
  out.push(60);
  return out;
}

/**
 * The blade surface in the blade frame (open at the trailing edge) and the flatback
 * trailing-edge strip as a separate geometry so its edges stay crisp.
 */
export function buildBladeGeometry({ ring = 64, spanScale = 1, colors = true } = {}) {
  const stations = bladeStations(spanScale);
  const half = ring >> 1, loop = half * 2 + 1;
  const pos: number[] = [], uv: number[] = [], col: number[] = [];
  const tePos: number[] = [];
  const p: [number, number] = [0, 0];
  for (let si = 0; si < stations.length; si++) {
    const r = stations[si];
    for (let i = 0; i < loop; i++) {
      const q = i / (loop - 1);
      sectionPoint(r, q, p);
      pos.push(r, p[0], p[1]);
      uv.push((r - TURBINE.rootR) / (TURBINE.tipR - TURBINE.rootR), q);
      if (colors) {
        // multiplies the paint colour: leading-edge protection tape outboard, a little
        // grime around the root bolts
        const le = Math.exp(-(((q - 0.5) / 0.045) ** 2)) * smoothstep((r - 36) / 6);
        const root = 1 - smoothstep((r - 2) / 5);
        // the two moulded shells are bonded along both edges: a faint line on each
        const bond = (Math.exp(-(((q - 0.5) / 0.007) ** 2)) + Math.exp(-((q / 0.012) ** 2)) + Math.exp(-(((q - 1) / 0.012) ** 2))) * (r > 4 ? 1 : 0);
        const d = 0.05 * le + 0.06 * bond;
        col.push(1 - d - 0.07 * root, 1 - d * 0.95 - 0.075 * root, 1 - d * 0.8 - 0.08 * root);
      }
    }
    sectionPoint(r, 0, p); const tu = [r, p[0], p[1]];
    sectionPoint(r, 1, p); const tl = [r, p[0], p[1]];
    tePos.push(...tl, ...tu);
  }
  const idx: number[] = [];
  for (let si = 0; si < stations.length - 1; si++) {
    for (let i = 0; i < loop - 1; i++) {
      const a = si * loop + i, b = a + 1, c = a + loop, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const surface = new THREE.BufferGeometry();
  surface.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  surface.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (colors) surface.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  surface.setIndex(idx);
  surface.computeVertexNormals();

  const teIdx: number[] = [];
  for (let si = 0; si < stations.length - 1; si++) {
    // a, c: pressure-side edge; b, d: suction-side edge — the face looks downstream (+y)
    const a = si * 2, b = a + 1, c = a + 2, d = a + 3;
    teIdx.push(a, c, b, b, c, d);
  }
  const te = new THREE.BufferGeometry();
  te.setAttribute('position', new THREE.Float32BufferAttribute(tePos, 3));
  te.setIndex(teIdx);
  te.computeVertexNormals();
  const teUv = new Float32Array((tePos.length / 3) * 2);
  te.setAttribute('uv', new THREE.BufferAttribute(teUv, 2));
  if (colors) te.setAttribute('color', new THREE.Float32BufferAttribute(new Array(tePos.length).fill(0.86), 3));
  return { surface, te };
}

/** A small patch of a blade surface (for the example defect), offset along its normals. */
export function buildBladePatch(r0: number, r1: number, q0: number, q1: number, { nr = 24, nq = 24, offset = 0.004 } = {}) {
  const pos: number[] = [], uv: number[] = [];
  const p: [number, number] = [0, 0];
  for (let j = 0; j <= nr; j++) {
    const r = r0 + ((r1 - r0) * j) / nr;
    for (let i = 0; i <= nq; i++) {
      const q = q0 + ((q1 - q0) * i) / nq;
      sectionPoint(r, q, p);
      pos.push(r, p[0], p[1]);
      uv.push(j / nr, i / nq);
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < nr; j++) for (let i = 0; i < nq; i++) {
    const a = j * (nq + 1) + i, b = a + 1, c = a + nq + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const P = g.getAttribute('position'), N = g.getAttribute('normal');
  for (let i = 0; i < P.count; i++) P.setXYZ(i, P.getX(i) + N.getX(i) * offset, P.getY(i) + N.getY(i) * offset, P.getZ(i) + N.getZ(i) * offset);
  return g;
}

// ------------------------------------------------------------------ transforms
const _m = new THREE.Matrix4();
/** Blade frame → rotor frame. */
export function bladeMatrix(id: BladeId, pitch: number = TURBINE.parkedPitch, azimuthOffsetDeg = 0) {
  const psi = deg(TURBINE.azimuth[id] + azimuthOffsetDeg);
  const m = new THREE.Matrix4().makeRotationZ(Math.PI / 2 - psi);
  m.multiply(_m.makeRotationY(-TURBINE.cone));
  m.multiply(_m.makeRotationX(-pitch));
  return m;
}
/** Rotor frame → world. */
export function rotorMatrix() {
  return new THREE.Matrix4().makeTranslation(0, TURBINE.hubHeight, TURBINE.hubZ).multiply(_m.makeRotationX(-TURBINE.tilt));
}
export function bladeToWorld(id: BladeId, pitch: number = TURBINE.parkedPitch) {
  return rotorMatrix().multiply(bladeMatrix(id, pitch));
}

/** World point on a parked blade's surface at span r and loop parameter q (0.5 = leading edge). */
export function bladeSurfaceWorld(id: BladeId, r: number, q: number, out = new THREE.Vector3()) {
  const p = sectionPoint(r, q);
  return out.set(r, p[0], p[1]).applyMatrix4(bladeToWorld(id));
}
/** World point on a parked blade's pitch axis (pre-bend included). */
export function bladeAxisWorld(id: BladeId, r: number, out = new THREE.Vector3()) {
  return out.set(r, 0, prebend(r)).applyMatrix4(bladeToWorld(id));
}

/**
 * The example defect: blade B, on the leading edge and wrapping towards the suction side
 * (which faces up on the parked blade B), 44 m from the hub centre — 42 m from the root.
 */
export const DEFECT = { blade: 'B' as BladeId, r: 44, q: 0.47, span: [43.2, 45.0] as const, chord: [0.38, 0.56] as const };

// ------------------------------------------------------------------ tower, nacelle, hub
const latheY = lathe;

export function buildTowerGeometry(segments = 64) {
  const base = 2.15, top = 1.45, h = TURBINE.towerTop - 0.25;
  const profile: [number, number][] = [[0.01, -0.4], [base + 0.06, -0.4], [base + 0.06, 0.02], [base, 0.12]];
  const flanges = [22.8, 47.3, 72.1];
  const radiusAt = (y: number) => base + (top - base) * (y / h);
  for (let y = 0.5; y < h; y += 2.5) {
    const f = flanges.find((fy) => Math.abs(fy - y) < 1.25);
    if (f !== undefined) {
      profile.push([radiusAt(f - 0.12), f - 0.12], [radiusAt(f) + 0.035, f - 0.06], [radiusAt(f) + 0.035, f + 0.06], [radiusAt(f + 0.12), f + 0.12]);
    } else profile.push([radiusAt(y), y]);
  }
  profile.push([top, h], [top + 0.12, h + 0.02], [top + 0.12, h + 0.25], [0.01, h + 0.25]);
  profile.sort((a, b) => a[1] - b[1]);
  return latheY(profile, segments);
}

/** Nacelle housing; origin at the yaw bearing (tower top), +z upwind. */
export function buildNacelleGeometry(ring = 56) {
  const y = 2.2;
  return loftSquircle([
    { z: 2.75, w: 2.4, h: 2.5, y: 2.42, n: 4 },
    { z: 2.55, w: 3.3, h: 3.35, y: 2.33, n: 5 },
    { z: 1.9, w: 3.85, h: 3.85, y: 2.26, n: 6 },
    { z: 0.6, w: 4.0, h: 4.0, y, n: 7 },
    { z: -5.5, w: 4.08, h: 4.1, y: 2.24, n: 7 },
    { z: -8.6, w: 3.98, h: 3.95, y: 2.28, n: 7 },
    { z: -9.25, w: 3.6, h: 3.5, y: 2.3, n: 6 },
    { z: -9.55, w: 2.6, h: 2.3, y: 2.32, n: 4 },
  ], ring);
}

/** Roof equipment: rear cooler, anemometer mast with cups and vane, obstruction lights' posts. */
export function buildNacelleDetails() {
  const parts: THREE.BufferGeometry[] = [];
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); parts.push(g); };
  const cyl = (r: number, h: number, x: number, y: number, z: number, seg = 12) => { const g = new THREE.CylinderGeometry(r, r, h, seg); g.translate(x, y + h / 2, z); parts.push(g); };
  // cooler: frame and fins
  box(3.3, 0.16, 2.3, 0, 4.32, -7.6);
  for (let i = 0; i < 12; i++) box(3.2, 1.25, 0.05, 0, 5.0, -8.65 + i * 0.19);
  box(3.3, 0.12, 2.3, 0, 5.66, -7.6);
  for (const x of [-1.62, 1.62]) box(0.08, 1.4, 2.3, x, 4.99, -7.6);
  // met mast with anemometer and vane
  cyl(0.05, 2.0, -1.2, 4.2, -5.6); cyl(0.05, 2.0, 1.2, 4.2, -5.6);
  box(2.5, 0.07, 0.07, 0, 6.15, -5.6);
  cyl(0.03, 0.5, -1.2, 6.18, -5.6, 8); cyl(0.03, 0.5, 1.2, 6.18, -5.6, 8);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const arm = new THREE.BoxGeometry(0.3, 0.02, 0.02); arm.translate(0.15, 0, 0); arm.rotateY(a); arm.translate(-1.2, 6.7, -5.6); parts.push(arm);
    const cup = new THREE.SphereGeometry(0.06, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); cup.rotateZ(Math.PI / 2); cup.translate(0.3, 0, 0); cup.rotateY(a); cup.translate(-1.2, 6.7, -5.6); parts.push(cup);
  }
  const vane = new THREE.BoxGeometry(0.02, 0.18, 0.5); vane.translate(1.2, 6.72, -5.85); parts.push(vane);
  // hatch frame on the roof
  box(1.4, 0.05, 1.6, 0, 4.29, -2.2);
  // lights' posts (the red lamps are separate emissive meshes)
  cyl(0.04, 0.55, -1.0, 5.66, -6.6, 8); cyl(0.04, 0.55, 1.0, 5.66, -6.6, 8);
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}
export const OBSTRUCTION_LIGHTS: [number, number, number][] = [[-1.0, 6.28, -6.6], [1.0, 6.28, -6.6]];

/** Panel joints: thin raised bands following the housing's cross-section. */
export function buildNacelleSeams() {
  // the housing between its widest sections (see buildNacelleGeometry): z 0.6 → −5.5
  const at = (z: number) => {
    const t = (0.6 - z) / 6.1;
    return { w: 4.0 + 0.08 * t + 0.035, h: 4.0 + 0.1 * t + 0.035, y: 2.2 + 0.04 * t };
  };
  return merge([1.0, -1.8, -4.6].map((z) => {
    const s = at(z);
    return loftSquircle([{ z: z + 0.03, ...s, n: 7 }, { z: z - 0.03, ...s, n: 7 }], 64);
  }));
}

/** Lightning receptors near the tip, one on each face (blade frame). */
export function buildReceptors() {
  return merge([0.27, 0.73].map((q) => buildBladePatch(58.45, 58.6, q - 0.012, q + 0.012, { nr: 4, nq: 4, offset: 0.006 })));
}

/** Spinner (nose cone) in the rotor frame: axis along +z. */
export function buildSpinnerGeometry(segments = 64) {
  const profile: [number, number][] = [[0.01, -0.9], [2.05, -0.9], [2.12, -0.5], [2.16, 0.2], [2.08, 1.1], [1.84, 2.0], [1.45, 2.85], [0.95, 3.5], [0.45, 3.95], [0.01, 4.12]];
  const g = latheY(profile.map(([r, z]) => [r, z]), segments);
  g.rotateX(Math.PI / 2); // lathe y → rotor z
  return g;
}

/** Door, landing and steps at the tower base, facing +x (towards the crane pad). */
export function buildTowerBase() {
  const parts: THREE.BufferGeometry[] = [];
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); parts.push(g); };
  box(0.12, 2.3, 1.05, 2.12, 1.95, 0); // door leaf
  box(0.1, 0.12, 1.3, 2.15, 3.18, 0); // lintel
  box(1.6, 0.12, 1.8, 2.95, 0.72, 0); // landing
  for (let i = 0; i < 4; i++) box(0.32, 0.12, 1.4, 3.9 + i * 0.32, 0.6 - i * 0.18, 0);
  for (const z of [-0.88, 0.88]) { box(0.04, 1.0, 0.04, 3.7, 1.25, z); box(1.6, 0.04, 0.04, 2.95, 1.75, z); }
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}

/**
 * The inspected turbine as world-space geometries (one per part), for collision tests and
 * for anything that needs exact surfaces. Blades are parked (feathered) at their azimuths.
 */
export function turbineWorldGeometries({ ring = 48, spanScale = 0.7 } = {}) {
  const tower = buildTowerGeometry(48);
  const top = new THREE.Matrix4().makeTranslation(0, TURBINE.towerTop, 0);
  const nacelle = buildNacelleGeometry(40).applyMatrix4(top);
  const details = buildNacelleDetails().applyMatrix4(top);
  const spinner = buildSpinnerGeometry(48).applyMatrix4(rotorMatrix());
  const blades = BLADES.map((id) => {
    const { surface } = buildBladeGeometry({ ring, spanScale, colors: false });
    return surface.applyMatrix4(bladeToWorld(id));
  });
  return { tower, nacelle, details, spinner, blades };
}
