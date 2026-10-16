// Close-up surfaces for the cover proposals, generated in the browser (no downloaded maps):
// the blade paint over the stretch of span the covers look at, the example leading-edge
// erosion with its relief, and propellers smeared by their spin. Everything is laid out in
// physical units (metres along the span and around the section) so wear sits where it does on
// a real blade: protection tape about 14 cm either side of the nose, insect residue and rain
// pitting on the nose towards the tip, dirt washed back along the chord, grime at the trailing
// edge.
import * as THREE from 'three';
import { noise2, rng } from '../src/experience/math';
import type { DroneRig } from '../src/experience/models/drone';
import { TURBINE, sectionPoint } from '../src/experience/models/turbine';

const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };

function dataTexture(data: Uint8Array, w: number, h: number, srgb: boolean) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8; t.needsUpdate = true;
  return t;
}

/** Tangent-space normal map from heights (m); du: texel size along u (m), dv(x, y): along v. */
function normalMap(h: Float32Array, w: number, hh: number, du: number, dv: (x: number, y: number) => number) {
  const out = new Uint8Array(w * hh * 4);
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
    const xl = Math.max(0, x - 1), xr = Math.min(w - 1, x + 1), yd = Math.max(0, y - 1), yu = Math.min(hh - 1, y + 1);
    const sx = (h[y * w + xr] - h[y * w + xl]) / ((xr - xl) * du);
    const sy = (h[yu * w + x] - h[yd * w + x]) / ((yu - yd) * dv(x, y));
    const l = Math.hypot(sx, sy, 1), i = (y * w + x) * 4;
    out[i] = (-sx / l * 0.5 + 0.5) * 255; out[i + 1] = (-sy / l * 0.5 + 0.5) * 255; out[i + 2] = (1 / l * 0.5 + 0.5) * 255; out[i + 3] = 255;
  }
  return out;
}

/**
 * Arc length (m) around the section at span r, from the nose (q = 0.5), for each of n rows
 * q = (y + 0.5) / n: negative on the suction side. Also the trailing-edge ends.
 */
function arcFromNose(r: number, n: number) {
  const s = new Float32Array(n), p: [number, number] = [0, 0], prev: [number, number] = [0, 0];
  sectionPoint(r, 0, prev);
  let acc = 0, nose = 0;
  for (let y = 0; y < n; y++) {
    const q = (y + 0.5) / n;
    sectionPoint(r, q, p);
    acc += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    s[y] = acc;
    prev[0] = p[0]; prev[1] = p[1];
    if (y === (n >> 1) - 1) { sectionPoint(r, 0.5, p); nose = acc + Math.hypot(p[0] - prev[0], p[1] - prev[1]); prev[0] = p[0]; prev[1] = p[1]; acc = nose; }
  }
  sectionPoint(r, 1, p);
  const total = acc + Math.hypot(p[0] - prev[0], p[1] - prev[1]);
  for (let y = 0; y < n; y++) s[y] -= nose;
  return { s, teSuction: -nose, tePressure: total - nose };
}

/** The span (m from the hub centre) the blade skin covers; outside it the edge texels repeat. */
export const SKIN_SPAN = [26, 54] as const;

/**
 * The blade paint: colour, roughness (green) and a normal map for relief at the millimetre
 * scale (tape edges, waviness of the moulded shell, pits), in the blade's uv layout restricted
 * to SKIN_SPAN (apply `skinTransform` to each map).
 */
export function bladeSkin() {
  const [R0, R1] = SKIN_SPAN, W = 4096, H = 1024;
  const n = noise2(77), m = noise2(78), k = noise2(79), r = rng(3);
  const col = new Uint8Array(W * H * 4), rough = new Uint8Array(W * H * 4);
  const hgt = new Float32Array(W * H), S = new Float32Array(W * H);
  const WT = 0.14; // half-width of the leading-edge protection tape (m)
  // sanded and re-coated repairs: a shade brighter and glossier, soft-edged
  const repairs = Array.from({ length: 5 }, () => ({ r: R0 + 2 + r() * (R1 - R0 - 4), s: (r() < 0.5 ? -1 : 1) * (0.35 + r() * 1.1), hr: 0.25 + r() * 0.5, hs: 0.12 + r() * 0.25 }));
  for (let x = 0; x < W; x++) {
    const rM = R0 + ((R1 - R0) * (x + 0.5)) / W;
    const { s: arc, teSuction, tePressure } = arcFromNose(rM, H);
    const lep = smooth((rM - 30) / 3);
    const outboard = smooth((rM - 34) / 14);
    for (let y = 0; y < H; y++) {
      const s = arc[y], sa = Math.abs(s), i = y * W + x;
      S[i] = s;
      // base paint: broad tone and gloss variation, faint mottling, waviness of the shell
      let tone = 1 + 0.035 * n(rM / 2.2, s / 0.8, 3) + 0.012 * m(rM * 5, s * 11, 2);
      let rg = 0.34 + 0.08 * k(rM / 1.4, s / 0.6, 3);
      let warm = 0;
      let h = 0.00025 * n(rM / 0.11 + 31, s / 0.08 + 5, 2);
      for (const p of repairs) {
        const f = smooth((p.hr - Math.abs(rM - p.r)) / 0.05) * smooth((p.hs - Math.abs(s - p.s)) / 0.04);
        tone += 0.03 * f; rg -= 0.08 * f; h += 0.0002 * f;
      }
      // dirt washed back along the chord from the nose, more of it outboard
      const streak = Math.max(0, m(rM * 18 + 3, s * 0.7 + 7, 3) + 0.2) * smooth((sa - 0.03) / 0.05) * (1 - smooth((sa - 0.15) / 0.8)) * (0.4 + 0.6 * outboard);
      tone -= 0.11 * streak; warm += 0.025 * streak; rg += 0.06 * streak;
      // grime and the bond line along the trailing edge
      const te = Math.min(s - teSuction, tePressure - s);
      const teG = 1 - smooth(te / 0.2);
      tone -= 0.08 * teG; warm += 0.025 * teG; rg += 0.1 * teG;
      tone -= 0.05 * Math.exp(-((te / 0.006) ** 2));
      // leading-edge protection: a slightly warmer, glossier band, a dirt line at each tape edge
      if (lep > 0) {
        const inside = smooth((WT - sa) / 0.002) * lep;
        tone -= 0.025 * inside; warm += 0.014 * inside; rg += (0.24 - rg) * inside;
        h += 0.0005 * inside; // tape thickness
        const edge = Math.exp(-(((sa - WT) / 0.0018) ** 2)) * lep;
        tone -= 0.17 * edge; warm += 0.03 * edge; rg += 0.2 * edge;
      }
      // the nose: bond line, insect residue and grime outboard
      tone -= 0.035 * Math.exp(-((s / 0.003) ** 2));
      const nose = Math.exp(-((s / 0.028) ** 2)) * outboard;
      tone -= 0.07 * nose * (0.55 + 0.45 * n(rM * 40, s * 160, 2)); warm += 0.04 * nose; rg += 0.14 * nose;
      const j = i * 4, base = Math.min(1.06, tone);
      col[j] = Math.min(255, 229 * base * (1 + warm)); col[j + 1] = Math.min(255, 232 * base * (1 + warm * 0.35)); col[j + 2] = Math.min(255, 231 * base * (1 - warm)); col[j + 3] = 255;
      rough[j + 1] = Math.min(255, Math.max(0, rg * 255)); rough[j + 3] = 255;
      hgt[i] = h;
    }
  }
  // insect strikes on the nose and rain-erosion pits towards the tip, as small splats
  const du = (R1 - R0) / W;
  const splat = (cx: number, cy: number, rad: number, dark: number, depth: number, rgAdd: number) => {
    for (let dy = -rad - 1; dy <= rad + 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = cx + dx, yy = cy + dy;
      if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
      const f = Math.exp(-(dx * dx * 1.5 + (dy * dy) / Math.max(0.6, rad * rad)));
      const i = yy * W + xx, j = i * 4;
      col[j] *= 1 - (1 - dark) * f; col[j + 1] *= 1 - (1 - dark * 0.97) * f; col[j + 2] *= 1 - (1 - dark * 0.9) * f;
      rough[j + 1] = Math.min(255, rough[j + 1] + rgAdd * f);
      hgt[i] -= depth * f;
    }
  };
  const rowOf = (x: number, s: number) => { let lo = 0, hi = H - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (S[mid * W + x] < s) lo = mid + 1; else hi = mid; } return lo; };
  for (let t = 0; t < 12000; t++) {
    const rM = 36 + (R1 - 36) * Math.sqrt(r()), x = Math.floor(((rM - R0) / (R1 - R0)) * W);
    const s = (r() - 0.5) * 0.09 * (0.3 + r());
    splat(x, rowOf(x, s), r() < 0.8 ? 1 : 2, 0.45 + 0.35 * r(), 0.00008, 40);
  }
  for (let t = 0; t < 5000; t++) {
    const rM = 46 + (R1 - 46) * Math.sqrt(r()), x = Math.floor(((rM - R0) / (R1 - R0)) * W);
    const s = (r() - 0.5) * 0.05 * (0.4 + r());
    splat(x, rowOf(x, s), r() < 0.7 ? 1 : 2, 0.6 + 0.25 * r(), 0.0004, 70);
  }
  const nrm = normalMap(hgt, W, H, du, (x, y) => Math.max(0.0008, Math.abs(S[Math.min(H - 1, y + 1) * W + x] - S[Math.max(0, y - 1) * W + x]) / 2));
  return { map: dataTexture(col, W, H, true), roughnessMap: dataTexture(rough, W, H, false), normalMap: dataTexture(nrm, W, H, false) };
}

/** Maps the blade's uv (u = 0 at the root, 1 at the tip) onto SKIN_SPAN. */
export function skinTransform(t: THREE.Texture) {
  const [R0, R1] = SKIN_SPAN, span = TURBINE.tipR - TURBINE.rootR;
  t.repeat.set(span / (R1 - R0), 1);
  t.offset.set((TURBINE.rootR - R0) / (R1 - R0), 0);
  return t;
}

/**
 * Leading-edge erosion on a patch spanning r0…r1 and q0…q1 of the section loop: the coating
 * worn off along the nose down to the filler and the glass laminate, ragged chipped borders,
 * pits around it. Colour with alpha (transparent where the paint is intact), relief, roughness.
 */
export function erosionMaps(r0: number, r1: number, q0: number, q1: number) {
  const W = 1024, H = 512, n = noise2(23), m = noise2(24), r = rng(9);
  const loop = arcFromNose((r0 + r1) / 2, 2048);
  const sAt = (q: number) => loop.s[Math.min(2047, Math.max(0, Math.floor(q * 2048)))];
  const col = new Uint8Array(W * H * 4), rough = new Uint8Array(W * H * 4), hgt = new Float32Array(W * H);
  const pits = Array.from({ length: 900 }, () => {
    const s = (r() - 0.5) * 0.16 * (0.25 + r() * 0.75);
    return { x: r() * W, s, rad: 0.0015 + r() * r() * 0.004 };
  });
  for (let y = 0; y < H; y++) {
    const s = sAt(q0 + ((q1 - q0) * (y + 0.5)) / H);
    for (let x = 0; x < W; x++) {
      const t = (x + 0.5) / W, rr = r0 + (r1 - r0) * t, i = y * W + x, j = i * 4;
      const ends = Math.sin(Math.PI * t) ** 0.45;
      const core = Math.exp(-((s / 0.03) ** 2)), wide = Math.exp(-(((s + 0.012) / 0.075) ** 2));
      const rag = n(rr / 0.06, s / 0.011, 5);
      const e = ends * (0.62 * core + 0.42 * wide) + 0.38 * rag - 0.43;
      let a = 0, c = [0, 0, 0], rg = 0.4, h = 0;
      if (e > 0) {
        a = 1;
        if (e < 0.07) { c = [203, 201, 194]; rg = 0.72; h = -0.0003; } // filler under the paint
        else {
          // glass laminate: biaxial fibres as a faint diagonal hatch
          const fib = 0.06 * Math.sin((rr * 900 + s * 900)) * Math.sin((rr * 900 - s * 900)) + 0.05 * m(rr * 80, s * 300, 2);
          const g = 0.93 + fib;
          c = [150 * g, 146 * g, 128 * g]; rg = 0.84; h = -0.0008 - 0.0004 * Math.max(0, m(rr * 30, s * 90, 2));
        }
        if (e < 0.02) { c = [c[0] * 0.8, c[1] * 0.8, c[2] * 0.79]; } // dirt caught at the chipped border
      }
      col[j] = c[0]; col[j + 1] = c[1]; col[j + 2] = c[2]; col[j + 3] = a * 255;
      rough[j + 1] = rg * 255; rough[j + 3] = 255;
      hgt[i] = h;
    }
  }
  // pits in and around the worn strip
  const rowS = Float32Array.from({ length: H }, (_, y) => sAt(q0 + ((q1 - q0) * (y + 0.5)) / H));
  const sRow = (s: number) => { let lo = 0, hi = H - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (rowS[mid] < s) lo = mid + 1; else hi = mid; } return lo; };
  const dsAt = (y: number) => Math.max(0.0003, Math.abs(rowS[Math.min(H - 1, y + 1)] - rowS[Math.max(0, y - 1)]) / 2), dx = (r1 - r0) / W;
  for (const p of pits) {
    const cy = sRow(p.s), rx = p.rad / dx, ry = p.rad / dsAt(cy);
    for (let yy = Math.floor(cy - ry - 1); yy <= cy + ry + 1; yy++) for (let xx = Math.floor(p.x - rx - 1); xx <= p.x + rx + 1; xx++) {
      if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
      const d2 = ((xx - p.x) / rx) ** 2 + ((yy - cy) / ry) ** 2;
      if (d2 > 1) continue;
      const i = yy * W + xx, j = i * 4, f = 1 - d2;
      col[j] = 88 + 20 * (1 - f); col[j + 1] = 86 + 20 * (1 - f); col[j + 2] = 80 + 18 * (1 - f); col[j + 3] = 255;
      rough[j + 1] = 235;
      hgt[i] = Math.min(hgt[i], -0.0006 - 0.0012 * f);
    }
  }
  const nrm = normalMap(hgt, W, H, dx, (_x, y) => dsAt(y));
  return { map: dataTexture(col, W, H, true), roughnessMap: dataTexture(rough, W, H, false), normalMap: dataTexture(nrm, W, H, false) };
}

/**
 * Propellers caught mid-spin, as a camera at a short shutter sees them: each blade smeared
 * over an arc of `arc` radians by `copies` faint copies. `phase` turns every propeller.
 */
export function smearProps(drone: DroneRig, { arc = 0.95, copies = 16, phase = 0 } = {}) {
  for (const pr of drone.props) {
    pr.blades.visible = false;
    const old = pr.node.getObjectByName('smear');
    if (old) pr.node.remove(old);
    const g = new THREE.Group();
    g.name = 'smear';
    const mat = (pr.blades.material as THREE.MeshPhysicalMaterial).clone();
    mat.transparent = true;
    mat.opacity = 0.17;
    mat.depthWrite = false;
    for (let c = 0; c < copies; c++) {
      const b = new THREE.Mesh(pr.blades.geometry, mat);
      b.rotation.y = -pr.dir * (arc * c) / (copies - 1);
      g.add(b);
    }
    pr.node.add(g);
  }
  spinProps(drone, phase);
}

/** Turns the smeared propellers to a new phase (a new frame of a sequence): transforms only. */
export function spinProps(drone: DroneRig, phase: number) {
  for (const [p, pr] of drone.props.entries()) {
    const g = pr.node.getObjectByName('smear');
    if (g) g.rotation.y = phase * (1 + 0.37 * p) + p * 1.9;
  }
}
