// The surroundings as an HDR equirectangular map (linear radiance), seen from about 100 m up:
// a clear late-afternoon sky (deep blue overhead, a pale horizon warming towards the low sun,
// a soft glow around it), two bands of distant hills, and the ground below the horizon with
// fields, woods and roads fading into haze with distance. It is both background and light.
import * as THREE from 'three';
import { noise2 } from '../src/experience/math';

export type SkyOptions = { sun: THREE.Vector3; width?: number; brightness?: number; height?: number };

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const ZENITH = [0.006, 0.016, 0.05], UPPER = [0.024, 0.06, 0.16], HORIZON = [0.2, 0.26, 0.36], WARM = [0.8, 0.6, 0.42];
const n1 = noise2(91), n2 = noise2(17), n3 = noise2(53);

/** Albedo of the land at ground coordinates (m): fields of a few hectares, woods, hedges, roads. */
function landAlbedo(x0: number, z0: number, out: number[]) {
  // field boundaries follow the lie of the land: warp the plane a little before cutting it up
  const x = x0 + 34 * n2(x0 / 420 + 3, z0 / 420, 2), z = z0 + 34 * n2(x0 / 420, z0 / 420 - 5, 2);
  const cs = 190, gx = Math.floor(x / cs), gz = Math.floor(z / cs);
  let best = 1e9, second = 1e9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = gx + i, cz = gz + j;
    const h = Math.sin(cx * 127.1 + cz * 311.7) * 43758.5453, r = h - Math.floor(h);
    const h2 = Math.sin(cx * 269.5 + cz * 183.3) * 43758.5453, r2 = h2 - Math.floor(h2);
    const px = (cx + 0.15 + 0.7 * r) * cs, pz = (cz + 0.15 + 0.7 * r2) * cs;
    const d = Math.max(Math.abs(x - px), Math.abs(z - pz) * 0.8);
    if (d < best) { second = best; best = d; id = r * 0.73 + r2 * 0.41; } else if (d < second) second = d;
  }
  const k = (id * 7.31) % 1;
  const crops = [[0.08, 0.095, 0.055], [0.115, 0.105, 0.07], [0.095, 0.083, 0.06], [0.07, 0.085, 0.05], [0.105, 0.1, 0.068]];
  const c = crops[Math.floor(k * crops.length)];
  // uneven growth across the field, and tramlines every 24 m along the field's own direction
  const vary = 0.82 + 0.26 * (n1(x / 260, z / 260, 3) * 0.5 + 0.5) + 0.12 * n3(x / 22 + k * 40, z / 22 - k * 30, 2);
  const th = k * Math.PI, along = x * Math.cos(th) + z * Math.sin(th);
  const tram = Math.abs(((along % 24) + 24) % 24 - 12) < 0.8 ? 0.86 : 1;
  out[0] = c[0] * vary * tram; out[1] = c[1] * vary * tram; out[2] = c[2] * vary * tram;
  const blend = (r: number, g: number, b: number, t: number) => { out[0] += (r - out[0]) * t; out[1] += (g - out[1]) * t; out[2] += (b - out[2]) * t; };
  // a soft headland along every field edge, a hedge of trees along some of them
  const edge = second - best;
  blend(out[0] * 1.12, out[1] * 1.1, out[2] * 1.08, 1 - smooth(1.5, 7, edge));
  if (k > 0.45) blend(0.035, 0.05, 0.03, 0.75 * (1 - smooth(1.5, 4.5, edge + 2 * n3(x / 9, z / 9, 1))));
  const wood = n2(x / 900 + 7, z / 900 - 3, 4);
  if (wood > 0.32) blend(0.03, 0.045, 0.028, smooth(0.32, 0.4, wood));
  if (Math.abs(z - 380 * Math.sin(x / 1700) - 0.18 * x - 600) < 4 || Math.abs(x + 220 * Math.sin(z / 1300) - 1400) < 3.5) { out[0] = out[1] = out[2] = 0.11; }
  return out;
}

/** The surroundings as a float equirectangular texture, in three.js's equirect convention. */
export function skyTexture({ sun, width = 4096, brightness = 1, height = 100 }: SkyOptions) {
  const w = width, h = width / 2, s = sun.clone().normalize();
  const hs = Math.hypot(s.x, s.z) || 1;
  const data = new Float32Array(w * h * 4);
  // per azimuth: the warmth towards the sun, the haze colour at the horizon, the hill crests
  const warmCol = new Float32Array(w), hazeCol = new Float32Array(w * 3), farTop = new Float32Array(w), nearTop = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const az = ((x + 0.5) / w - 0.5) * Math.PI * 2, dx = Math.cos(az), dz = Math.sin(az);
    const cosA = Math.max(0, (dx * s.x + dz * s.z) / hs);
    warmCol[x] = cosA ** 6;
    const warm = cosA ** 6 * 0.5, ang = Math.acos(Math.min(1, Math.max(-1, dx * s.x + dz * s.z)));
    const glow = 0.32 * Math.exp(-ang / 0.2);
    for (let k = 0; k < 3; k++) hazeCol[x * 3 + k] = (HORIZON[k] + (WARM[k] - HORIZON[k]) * warm + glow * [1, 0.86, 0.7][k]) * 0.8;
    farTop[x] = 0.004 + 0.012 * (0.55 + 0.45 * n3(dx * 3 + 5, dz * 3 - 1, 4));
    nearTop[x] = 0.009 * (0.55 + 0.45 * n1(dx * 3 + 10, dz * 3 - 2, 4));
  }
  const alb = [0, 0, 0];
  const sunLight = [0.55 * Math.max(s.y, 0) * 3.4 + 0.12, 0.5 * Math.max(s.y, 0) * 3.2 + 0.13, 0.42 * Math.max(s.y, 0) * 3 + 0.16];
  for (let y = 0; y < h; y++) {
    const el = ((y + 0.5) / h - 0.5) * Math.PI, sy = Math.sin(el), cy = Math.cos(el);
    for (let x = 0; x < w; x++) {
      const az = ((x + 0.5) / w - 0.5) * Math.PI * 2, dx = cy * Math.cos(az), dz = cy * Math.sin(az);
      const i = (y * w + x) * 4, hz = hazeCol.subarray(x * 3, x * 3 + 3);
      let r: number, g: number, b: number;
      if (el > Math.max(farTop[x], 0)) {
        const t1 = smooth(0, 0.32, sy), t2 = smooth(0.22, 1, sy);
        r = HORIZON[0] + (UPPER[0] - HORIZON[0]) * t1; g = HORIZON[1] + (UPPER[1] - HORIZON[1]) * t1; b = HORIZON[2] + (UPPER[2] - HORIZON[2]) * t1;
        r += (ZENITH[0] - r) * t2; g += (ZENITH[1] - g) * t2; b += (ZENITH[2] - b) * t2;
        const wm = warmCol[x] * Math.exp(-sy * 9) * 0.5;
        r += (WARM[0] - r) * wm; g += (WARM[1] - g) * wm; b += (WARM[2] - b) * wm;
        const ang = Math.acos(Math.min(1, Math.max(-1, dx * s.x + sy * s.y + dz * s.z)));
        const glow = 1.6 * Math.exp(-ang / 0.035) + 0.32 * Math.exp(-ang / 0.2);
        r += glow; g += glow * 0.86; b += glow * 0.7;
      } else if (el > nearTop[x]) {
        r = 0.05 + (hz[0] - 0.05) * 0.72; g = 0.065 + (hz[1] - 0.065) * 0.72; b = 0.09 + (hz[2] - 0.09) * 0.72; // far hills
      } else if (el > -0.0035) {
        r = 0.035 + (hz[0] - 0.035) * 0.5; g = 0.045 + (hz[1] - 0.045) * 0.5; b = 0.06 + (hz[2] - 0.06) * 0.5; // near hills
      } else {
        // the land, lit by the low sun and the sky and hazed by distance; detailed down to
        // ~70° below the horizon (what a camera at the rotor can see), averaged under that
        const t = height / -sy;
        if (el > -1.22) landAlbedo(dx * t, dz * t, alb); else { alb[0] = 0.085; alb[1] = 0.09; alb[2] = 0.055; }
        const hzt = 1 - Math.exp(-t / 1700);
        r = alb[0] * sunLight[0] + (hz[0] - alb[0] * sunLight[0]) * hzt;
        g = alb[1] * sunLight[1] + (hz[1] - alb[1] * sunLight[1]) * hzt;
        b = alb[2] * sunLight[2] + (hz[2] - alb[2] * sunLight[2]) * hzt;
      }
      data[i] = r * brightness; data[i + 1] = g * brightness; data[i + 2] = b * brightness; data[i + 3] = 1;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
