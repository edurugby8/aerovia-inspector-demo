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
import { DEFECT, sectionPoint } from '../src/experience/models/turbine';

const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };

function dataTexture(data: Uint8Array, w: number, h: number, srgb: boolean) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8; t.needsUpdate = true;
  return t;
}

/** Tangent-space normal map from heights (m); du: texel size along u (m, or per column), dv(x, y): along v. */
function normalMap(h: Float32Array, w: number, hh: number, du: number | ((x: number) => number), dv: (x: number, y: number) => number) {
  const out = new Uint8Array(w * hh * 4);
  const duAt = typeof du === 'number' ? () => du : du;
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
    const xl = Math.max(0, x - 1), xr = Math.min(w - 1, x + 1), yd = Math.max(0, y - 1), yu = Math.min(hh - 1, y + 1);
    const sx = (h[y * w + xr] - h[y * w + xl]) / ((xr - xl) * duAt(x));
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

/** The stagnation line, where rain strikes hardest: a little towards the pressure side (m from the nose). */
const STAGNATION = 0.004;
/**
 * How matt and pinholed rain has left the coating around the example erosion on blade B (0…1).
 * It lives in the paint itself, not in the erosion decal: the path tracer's shadow rays treat a
 * partly transparent decal as opaque, which would darken the paint under a translucent halo.
 */
function erosionHalo(rM: number, s: number) {
  const end = Math.min(rM - DEFECT.span[0], DEFECT.span[1] - rM);
  return end <= 0 ? 0 : smooth((end - 0.03) / 0.35) * Math.exp(-(((s - STAGNATION) / 0.06) ** 2));
}

/** Where repairs are scattered (m from the hub centre). */
const SKIN_SPAN = [26, 54] as const;

/**
 * How the skin spends its columns along the span: knots of (radius in m, texture u). Most go to
 * the stretch the inspection shots see from close by (41–47 m: about 2.3 mm a texel); the rest
 * of the blade, only ever seen from further away, gets coarser ones.
 */
const SKIN_KNOTS: [number, number][] = [[2, 0], [26, 0.03], [41, 0.27], [47, 0.87], [60, 1]];
const piecewise = (k: [number, number][], x: number, a: 0 | 1, b: 0 | 1) => {
  if (x <= k[0][a]) return k[0][b];
  for (let i = 1; i < k.length; i++) if (x <= k[i][a]) { const t = (x - k[i - 1][a]) / (k[i][a] - k[i - 1][a]); return k[i - 1][b] + t * (k[i][b] - k[i - 1][b]); }
  return k[k.length - 1][b];
};
/** Texture u of the skin at span r; the blade geometry's uvs are remapped with it. */
export const skinU = (r: number) => piecewise(SKIN_KNOTS, r, 0, 1);
const skinRadius = (u: number) => piecewise(SKIN_KNOTS, u, 1, 0);

/**
 * The blade paint: colour, roughness (green) and a normal map for relief at the millimetre
 * scale (tape edges, waviness of the moulded shell, pits). u follows `skinU`, v the section
 * loop.
 */
export function bladeSkin({ w: W = 4096, h: H = 1024 } = {}) {
  const [R0, R1] = SKIN_SPAN;
  const n = noise2(77), m = noise2(78), k = noise2(79), r = rng(3);
  const col = new Uint8Array(W * H * 4), rough = new Uint8Array(W * H * 4);
  const hgt = new Float32Array(W * H), S = new Float32Array(W * H);
  const WT = 0.14; // half-width of the leading-edge protection tape (m)
  // sanded and re-coated repairs: a shade brighter and glossier, soft-edged
  const repairs = Array.from({ length: 5 }, () => ({ r: R0 + 2 + r() * (R1 - R0 - 4), s: (r() < 0.5 ? -1 : 1) * (0.35 + r() * 1.1), hr: 0.25 + r() * 0.5, hs: 0.12 + r() * 0.25 }));
  for (let x = 0; x < W; x++) {
    const rM = skinRadius((x + 0.5) / W);
    const { s: arc, teSuction, tePressure } = arcFromNose(rM, H);
    const lep = smooth((rM - 30) / 3);
    const outboard = smooth((rM - 34) / 14);
    for (let y = 0; y < H; y++) {
      const s = arc[y], sa = Math.abs(s), i = y * W + x;
      S[i] = s;
      // base paint: broad tone and gloss variation, faint mottling, waviness of the shell
      let tone = 1 + 0.035 * n(rM / 2.2, s / 0.8, 3) + 0.012 * m(rM * 5, s * 11, 2) + 0.008 * k(rM * 70 + 9, s * 140, 2);
      let rg = 0.34 + 0.08 * k(rM / 1.4, s / 0.6, 3);
      let warm = 0;
      let h = 0.00025 * n(rM / 0.11 + 31, s / 0.08 + 5, 2);
      for (const p of repairs) {
        const f = smooth((p.hr - Math.abs(rM - p.r)) / 0.05) * smooth((p.hs - Math.abs(s - p.s)) / 0.04);
        tone += 0.03 * f; rg -= 0.08 * f; h += 0.0002 * f;
      }
      // dirt washed back along the chord from the nose, more of it outboard
      // (the span coordinate is warped so the streaks fall at irregular spacings)
      const warp = rM * 18 + 3 + 1.8 * n(rM * 0.9 + 4, s * 1.7, 2);
      const streak = Math.max(0, m(warp, s * 0.7 + 7, 3) + 0.15) * (0.55 + 0.45 * k(rM * 0.7, 3.3, 2)) * smooth((sa - 0.03) / 0.05) * (1 - smooth((sa - 0.15) / 0.8)) * (0.4 + 0.6 * outboard);
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
      // matt, slightly greyed coating around the example erosion
      const hz = erosionHalo(rM, s);
      if (hz > 0.002) { tone -= 0.045 * hz; rg += (0.66 - rg) * hz; }
      // the nose: bond line, insect residue and grime outboard
      tone -= 0.035 * Math.exp(-((s / 0.003) ** 2));
      const nose = Math.exp(-((s / 0.028) ** 2)) * outboard;
      tone -= 0.045 * nose * (0.55 + 0.45 * n(rM * 40, s * 160, 2)); warm += 0.025 * nose; rg += 0.12 * nose;
      const j = i * 4, base = Math.min(1.06, tone);
      col[j] = Math.min(255, 229 * base * (1 + warm)); col[j + 1] = Math.min(255, 232 * base * (1 + warm * 0.35)); col[j + 2] = Math.min(255, 231 * base * (1 - warm)); col[j + 3] = 255;
      rough[j + 1] = Math.min(255, Math.max(0, rg * 255)); rough[j + 3] = 255;
      hgt[i] = h;
    }
  }
  // insect strikes on the nose and rain-erosion pits towards the tip, as small splats
  const du = (x: number) => Math.max(1e-4, (skinRadius((x + 1.5) / W) - skinRadius((x - 0.5) / W)) / 2);
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
  // (none where the example erosion's own, finer decal lies)
  const clear = (rM: number) => rM > DEFECT.span[0] - 0.03 && rM < DEFECT.span[1] + 0.03;
  for (let t = 0; t < 12000; t++) {
    const rM = 36 + (R1 - 36) * Math.sqrt(r()), x = Math.min(W - 1, Math.floor(skinU(rM) * W));
    const s = (r() - 0.5) * 0.09 * (0.3 + r()), big = r() < 0.8 ? 1 : 2, dark = 0.68 + 0.22 * r();
    if (!clear(rM)) splat(x, rowOf(x, s), big, dark, 0.00008, 40);
  }
  for (let t = 0; t < 5000; t++) {
    const rM = 46 + (R1 - 46) * Math.sqrt(r()), x = Math.min(W - 1, Math.floor(skinU(rM) * W));
    const s = (r() - 0.5) * 0.05 * (0.4 + r());
    splat(x, rowOf(x, s), r() < 0.7 ? 1 : 2, 0.68 + 0.2 * r(), 0.0004, 70);
  }
  const nrm = normalMap(hgt, W, H, du, (x, y) => Math.max(0.0008, Math.abs(S[Math.min(H - 1, y + 1) * W + x] - S[Math.max(0, y - 1) * W + x]) / 2));
  return { map: dataTexture(col, W, H, true), roughnessMap: dataTexture(rough, W, H, false), normalMap: dataTexture(nrm, W, H, false) };
}

/** Gives a blade geometry the skin's uvs: u from `skinU` of each vertex's span (its x). */
export function applySkinUvs(geo: THREE.BufferGeometry) {
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute, pos = geo.getAttribute('position');
  for (let i = 0; i < uv.count; i++) uv.setX(i, skinU(pos.getX(i)));
  uv.needsUpdate = true;
  return geo;
}

/** Value noise scaled to a standard deviation of about 1, so thresholds read as "how unusual". */
function unitNoise(seed: number, octaves: number) {
  const n = noise2(seed), r = rng(seed + 1000);
  let s2 = 0;
  for (let i = 0; i < 8192; i++) { const v = n(r() * 997, r() * 997, octaves); s2 += v * v; }
  const k = 1 / Math.sqrt(s2 / 8192);
  return (x: number, y: number) => n(x, y, octaves) * k;
}

/**
 * Leading-edge erosion on a patch spanning r0…r1 and q0…q1 of the section loop, as rain wears a
 * blade: either side of the stagnation line the coating turns matt and pinholed; nearer the
 * line it wears through in ragged islands to the grey filler and, where it is worst, to the
 * glass laminate (a biaxial fabric, resin-rich in places, the fibres dry and pale where the
 * resin has gone too); pits of every size gather towards the line and coalesce into gouges
 * along the span, and insects leave residue on the nose. About half a millimetre a texel, for
 * the close-up. Colour with alpha (transparent where the coating is still there: its matt halo is
 * in the paint), roughness (green) and relief.
 */
export function erosionMaps(r0: number, r1: number, q0: number, q1: number, { w: W = 4096 } = {}) {
  const N = 4096, loop = arcFromNose((r0 + r1) / 2, N);
  const sAt = (q: number) => loop.s[Math.min(N - 1, Math.max(0, Math.floor(q * N)))];
  const dx = (r1 - r0) / W;
  // rows about as fine as the columns
  const H = Math.min(2048, Math.max(256, Math.round(Math.abs(sAt(q1) - sAt(q0)) / dx / 64) * 64));
  const rowS = Float32Array.from({ length: H }, (_, y) => sAt(q0 + ((q1 - q0) * (y + 0.5)) / H));
  const dsAt = (y: number) => Math.max(1e-4, Math.abs(rowS[Math.min(H - 1, y + 1)] - rowS[Math.max(0, y - 1)]) / 2);
  const sRow = (s: number) => { let lo = 0, hi = H - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (rowS[mid] < s) lo = mid + 1; else hi = mid; } return lo; };
  const rag = unitNoise(23, 4), fine = unitNoise(26, 2), warp = noise2(24), lam = noise2(25), soft = noise2(27), r = rng(9);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

  const S0 = STAGNATION;
  const T1 = 0.4, T2 = 0.6; // the coating is gone above T1, the filler above T2 (≈ jittered)
  const COAT = [226, 227, 222], FILL = [203, 200, 190], DRY = [212, 210, 198];
  const C = new Float32Array(W * H * 3), A = new Float32Array(W * H), R = new Float32Array(W * H), Hh = new Float32Array(W * H);
  // how hard rain hits along the span: patchy, never reaching the ends of the patch
  const sevX = Float32Array.from({ length: W }, (_, x) => {
    const rr = r0 + (x + 0.5) * dx, end = Math.min(rr - r0, r1 - rr);
    return (0.8 + 0.12 * soft(rr / 0.3 + 11, 0.5, 3) / 0.3) * smooth(end / 0.04);
  });
  for (let y = 0; y < H; y++) {
    const d = rowS[y] - S0, ad = Math.abs(d);
    const across = Math.exp(-((d / 0.03) ** 2)), halo = Math.exp(-((d / 0.06) ** 2));
    const edgeY = smooth(Math.min(y, H - 1 - y) / (0.06 * H));
    for (let x = 0; x < W; x++) {
      const rr = r0 + (x + 0.5) * dx, i = y * W + x;
      const end = Math.min(rr - r0, r1 - rr);
      const fade = smooth((end - 0.03) / 0.35 + 0.25 * soft(rr / 0.25 + 3, d / 0.07, 2)) * sevX[x] * edgeY;
      let c0 = COAT[0], c1 = COAT[1], c2 = COAT[2], a = 0, rg = 0.3, h = 0;
      const hz = fade * halo;
      if (hz > 0.01 || ad < 0.06) {
        // ragged borders: domain-warped noise on axes turned away from the noise lattice
        const u = rr / 0.03, v = d / 0.02;
        const wu = u + 0.9 * warp(u * 0.3 + 5, v * 0.3, 2), wv = v + 0.9 * warp(u * 0.3 - 7, v * 0.3 + 3, 2);
        const z = 0.8 * rag(0.8 * wu + 0.6 * wv, -0.6 * wu + 0.8 * wv) + 0.3 * fine(rr / 0.005 + d / 0.008, d / 0.005 - rr / 0.008 + 40);
        const e = fade * across + 0.13 * z;
        const coat = smooth((T1 - e) / 0.018); // 1 where the coating remains
        const filler = smooth((T2 + 0.05 * fine(rr / 0.012 + 70, d / 0.009) - e) / 0.015); // 1 where the filler remains
        // matt, greyed coating around the worn strip (as the paint has it: see erosionHalo), shown
        // only where the decal is opaque
        c0 *= 1 - 0.05 * hz; c1 *= 1 - 0.05 * hz; c2 *= 1 - 0.045 * hz;
        rg = 0.3 + 0.36 * hz;
        if (coat < 1) {
          // filler: matt warm grey, mottled
          const mf = 1 + 0.035 * lam(rr / 0.006, d / 0.006, 2);
          let f0 = FILL[0] * mf, f1 = FILL[1] * mf, f2 = FILL[2] * mf, fr = 0.76, fh = -0.00045 + 0.00003 * lam(rr / 0.002, d / 0.002, 2);
          if (filler < 1) {
            // glass laminate: tows at ±45° in a plain weave, the fibres of the tow on top showing
            const ta = (rr + d) / 0.0068, tb = (rr - d) / 0.0068, ia = Math.floor(ta), ib = Math.floor(tb);
            const over = (ia + ib) & 1;
            const prof = over ? Math.sin(Math.PI * (tb - ib)) : Math.sin(Math.PI * (ta - ia));
            const fib = over ? lam(ta * 0.6, tb * 22, 2) : lam(ta * 22 + 50, tb * 0.6, 2);
            const resin = lam(rr / 0.02 + 20, d / 0.015, 3); // resin-rich (darker, yellower) or dry (paler)
            const dry = smooth((e - T2 - 0.08) / 0.12) * smooth(0.6 - resin);
            const g = 0.93 + 0.05 * prof + 0.07 * fib - 0.06 * resin;
            const grime = 1 - 0.1 * smooth(0.55 + soft(rr / 0.008, d / 0.006, 3));
            let l0 = 170 * g * grime, l1 = 166 * g * grime, l2 = (136 - 10 * resin) * g * grime;
            l0 += (DRY[0] - l0) * dry * 0.7; l1 += (DRY[1] - l1) * dry * 0.7; l2 += (DRY[2] - l2) * dry * 0.7;
            const lh = -0.00095 - 0.0004 * smooth((e - T2) / 0.25) + 0.00008 * prof + 0.00002 * fib;
            f0 += (l0 - f0) * (1 - filler); f1 += (l1 - f1) * (1 - filler); f2 += (l2 - f2) * (1 - filler);
            fr += (0.68 + 0.12 * fib - 0.1 * resin - fr) * (1 - filler);
            fh += (lh - fh) * (1 - filler);
          }
          // a line of grime caught under the chipped edge of the coating
          const lip = 1 - 0.09 * 4 * coat * (1 - coat);
          c0 += (f0 * lip - c0) * (1 - coat); c1 += (f1 * lip - c1) * (1 - coat); c2 += (f2 * lip - c2) * (1 - coat);
          rg += (fr - rg) * (1 - coat);
          h = fh * (1 - coat);
          a = Math.max(a, 1 - coat);
        }
      }
      C[i * 3] = c0; C[i * 3 + 1] = c1; C[i * 3 + 2] = c2; A[i] = a; R[i] = rg; Hh[i] = h;
    }
  }

  /**
   * Stamps a mark at texel (cx, cy): an ellipse with semi-axes `rad`·`aspect` along `theta` (0 =
   * along the span) and `rad` across (m), its outline made ragged by a few lobes. `depth` < 0 is
   * a pit, > 0 raised residue; `tint` multiplies the colour at its centre.
   */
  const stamp = (cx: number, cy: number, rad: number, aspect: number, theta: number, depth: number, tint: number[], rgh: number) => {
    const p1 = r() * 6.283, p2 = r() * 6.283, wob = 0.18 + 0.2 * r();
    const ds = dsAt(Math.min(H - 1, Math.max(0, Math.round(cy))));
    const ax = rad * aspect, by = rad, ext = Math.max(ax, by) * (1 + wob);
    const cover = Math.min(1, (Math.PI * ax * by) / (dx * ds)); // marks smaller than a texel only tint it
    const ex = Math.ceil(ext / dx) + 1, ey = Math.ceil(ext / ds) + 1, co = Math.cos(theta), si = Math.sin(theta);
    const x0 = Math.floor(cx), y0 = Math.floor(cy);
    for (let yy = y0 - ey; yy <= y0 + ey; yy++) {
      if (yy < 0 || yy >= H) continue;
      for (let xx = x0 - ex; xx <= x0 + ex; xx++) {
        if (xx < 0 || xx >= W) continue;
        const px = (xx + 0.5 - cx) * dx, py = (yy + 0.5 - cy) * ds;
        const u = (px * co + py * si) / ax, v = (-px * si + py * co) / by;
        const ph = Math.atan2(v, u), k = 1 + wob * (0.6 * Math.sin(3 * ph + p1) + 0.4 * Math.sin(5 * ph + p2));
        let q2 = (u * u + v * v) / (k * k);
        if (q2 >= 1) { if (cover < 1 && xx === x0 && yy === y0) q2 = 0; else continue; }
        const f = (1 - q2) ** 2 * cover, i = yy * W + xx;
        C[i * 3] *= 1 - (1 - tint[0]) * f; C[i * 3 + 1] *= 1 - (1 - tint[1]) * f; C[i * 3 + 2] *= 1 - (1 - tint[2]) * f;
        A[i] = Math.max(A[i], Math.min(1, 2.5 * f));
        R[i] += (rgh - R[i]) * Math.min(1, 2 * f);
        Hh[i] = Math.max(-0.003, Hh[i] + depth * f);
      }
    }
  };
  const at = (rr: number, d: number) => [(rr - r0) / dx, sRow(d + S0) + r()] as const;
  const inPatch = (rr: number, d: number) => rr > r0 + 0.02 && rr < r1 - 0.02 && d + S0 > rowS[0] && d + S0 < rowS[H - 1];
  const fadeAt = (rr: number) => sevX[Math.min(W - 1, Math.max(0, Math.floor((rr - r0) / dx)))] * smooth((Math.min(rr - r0, r1 - rr) - 0.03) / 0.3);
  // pinholes through the coating, thinning out away from the line
  for (let k = 0; k < 30000; k++) {
    const rr = r0 + r() * (r1 - r0), d = gauss() * 0.032;
    if (!inPatch(rr, d) || r() > fadeAt(rr) * Math.exp(-((d / 0.06) ** 2))) continue;
    const rad = 0.00014 + 0.0005 * r() ** 2.5, [cx, cy] = at(rr, d), dk = 0.62 + 0.2 * r();
    stamp(cx, cy, rad, 1 + 0.4 * r(), r() * Math.PI, -rad * (0.25 + 0.25 * r()), [dk, dk * 0.98, dk * 0.95], 0.9);
  }
  // pits in the worn strip, of every size: most under a millimetre, a few several
  for (let k = 0; k < 11000; k++) {
    const rr = r0 + r() * (r1 - r0), d = gauss() * 0.016;
    if (!inPatch(rr, d) || r() > fadeAt(rr)) continue;
    // (the big ones only where the strip is worst)
    const rad = 0.0002 + 0.0024 * r() ** 3.2 * Math.exp(-((d / 0.02) ** 2)), [cx, cy] = at(rr, d), dk = 0.5 + 0.25 * r();
    stamp(cx, cy, rad, 1 + 0.7 * r(), r() * Math.PI, -rad * (0.35 + 0.35 * r()), [dk, dk * 0.97, dk * 0.92], 0.92);
  }
  // pits coalesced into gouges along the span, on the line itself
  for (let k = 0; k < 220; k++) {
    let rr = r0 + r() * (r1 - r0), d = gauss() * 0.008;
    if (!inPatch(rr, d) || r() > fadeAt(rr)) continue;
    const len = 0.004 + 0.026 * r() ** 2, th = gauss() * 0.22, wid = 0.0007 + 0.0014 * r(), steps = Math.ceil(len / (wid * 0.8));
    for (let st = 0; st < steps; st++) {
      rr += Math.cos(th) * wid * 0.8; d += Math.sin(th) * wid * 0.8 + gauss() * wid * 0.15;
      if (!inPatch(rr, d)) break;
      const w = wid * (0.7 + 0.5 * r()), [cx, cy] = at(rr, d), dk = 0.72 + 0.14 * r();
      stamp(cx, cy, w, 1.3, th, -w * 0.4, [dk, dk * 0.97, dk * 0.92], 0.92);
    }
  }
  // insect residue on the nose: small, raised, brownish, smeared along the chord
  for (let k = 0; k < 1200; k++) {
    const rr = r0 + r() * (r1 - r0), d = 0.006 + gauss() * 0.02;
    if (!inPatch(rr, d) || r() > smooth((Math.min(rr - r0, r1 - rr) - 0.02) / 0.1)) continue;
    const rad = 0.0002 + 0.0004 * r() ** 2, [cx, cy] = at(rr, d), dk = 0.45 + 0.25 * r();
    stamp(cx, cy, rad, 1.3 + 1.2 * r(), Math.PI / 2 + gauss() * 0.3, 0.00002, [dk * 0.92, dk * 0.86, dk * 0.74], 0.55);
  }

  const col = new Uint8Array(W * H * 4), rough = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const j = i * 4;
    col[j] = Math.min(255, C[i * 3]); col[j + 1] = Math.min(255, C[i * 3 + 1]); col[j + 2] = Math.min(255, C[i * 3 + 2]); col[j + 3] = Math.round(A[i] * 255);
    rough[j + 1] = Math.min(255, Math.max(0, R[i] * 255)); rough[j + 3] = 255;
  }
  const nrm = normalMap(Hh, W, H, dx, (_x, y) => dsAt(y));
  return { map: dataTexture(col, W, H, true), roughnessMap: dataTexture(rough, W, H, false), normalMap: dataTexture(nrm, W, H, false) };
}

// the propeller planform (radius → chord, m) and pitch of models/drone.ts, for its blur
const PROP_R = 0.266, PROP_PITCH = 0.17;
const PROP_CHORD: [number, number][] = [[0.024, 0.022], [0.04, 0.032], [0.07, 0.042], [0.11, 0.0435], [0.17, 0.037], [0.22, 0.029], [0.25, 0.022], [0.262, 0.014], [0.266, 0.004]];
const propChord = (r: number) => {
  for (let i = 1; i < PROP_CHORD.length; i++) if (r <= PROP_CHORD[i][0]) { const [r0, c0] = PROP_CHORD[i - 1], [r1, c1] = PROP_CHORD[i]; return c0 + ((c1 - c0) * (r - r0)) / (r1 - r0); }
  return 0;
};

/**
 * How a two-blade propeller looks to a camera while it spins: each blade swept over an arc of
 * `arc` radians during the exposure, so a point is dark for the share of the exposure a blade
 * covers it. Dense near the hub where the blades are wide, faint at the tips. An alpha map
 * (green) in the propeller's plane, laid out like a RingGeometry's planar uvs.
 */
function propBlurTexture(arc: number, size = 512) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = ((x + 0.5) / size) * 2 - 1, py = ((y + 0.5) / size) * 2 - 1;
    const rho = Math.hypot(px, py) * PROP_R, th = Math.atan2(py, px);
    let cover = 0;
    if (rho > 0.026 && rho < PROP_R) {
      const pitch = Math.min(THREE.MathUtils.degToRad(38), Math.atan(PROP_PITCH / (2 * Math.PI * rho)));
      const w = (propChord(rho) * Math.cos(pitch)) / rho; // angular width of a blade here
      for (const k of [0, Math.PI]) {
        let d = th - k;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        // share of the exposure during which the blade, sweeping from 0 to `arc`, covers this angle
        cover += Math.max(0, Math.min(arc, d + w / 2) - Math.max(0, d - w / 2)) / arc;
      }
    }
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = Math.round(Math.min(1, cover) * 255); data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.colorSpace = THREE.NoColorSpace;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/**
 * Propellers caught mid-spin, as a camera at a short shutter (about 1/1000 s at hover speed)
 * sees them: the blades are replaced by one disc each that carries their motion blur.
 * `phase` turns every propeller to a new position.
 */
export function smearProps(drone: DroneRig, { arc = 0.6, phase = 0 } = {}) {
  const alphaMap = propBlurTexture(arc);
  for (const pr of drone.props) {
    pr.blades.visible = false;
    const old = pr.node.getObjectByName('smear');
    if (old) pr.node.remove(old);
    // a blurred blade reflects a softbox as a soft sheen, never a bright smear
    const mat = new THREE.MeshPhysicalMaterial({
      color: '#141619', roughness: 0.62, metalness: 0, specularIntensity: 0.45,
      alphaMap, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const geo = new THREE.RingGeometry(0.026, PROP_R, 128, 1);
    geo.rotateX(-Math.PI / 2);
    if (pr.dir < 0) geo.scale(-1, 1, 1); // the sweep runs the way this propeller turns
    const disc = new THREE.Mesh(geo, mat);
    disc.name = 'smear';
    disc.position.y = 0.002;
    pr.node.add(disc);
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
