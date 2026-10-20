// PBR materials with small procedural textures drawn once in the browser: carbon twill,
// polymer grain, paint variation and the example erosion decal. No downloaded maps.
import * as THREE from 'three';
import { noise2, remap, rng, smoothstep } from './math';
import type { DroneMaterials } from './models/drone';

type Pixel = (x: number, y: number) => [number, number, number, number];

function canvasTexture(w: number, h: number, draw: Pixel, srgb: boolean) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b, a] = draw(x, y);
    const i = (y * w + x) * 4;
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Normal map from a height function (tangent space, +z out). */
function normalFromHeight(w: number, h: number, height: (x: number, y: number) => number, strength: number) {
  const H = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) H[y * w + x] = height(x, y);
  const at = (x: number, y: number) => H[((y + h) % h) * w + ((x + w) % w)];
  return canvasTexture(w, h, (x, y) => {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1);
    return [(-dx / l * 0.5 + 0.5) * 255, (dy / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255, 255];
  }, false);
}

/** 2×2 twill: tows run diagonally; each tow is slightly rounded across its width. */
function twill(x: number, y: number, period: number) {
  const u = ((x + y) / period) % 2, v = ((x - y + 4096 * period) / period) % 2;
  const warp = Math.floor(u) === Math.floor(v) ? 1 : 0;
  const t = warp ? (u % 1) : (v % 1);
  return { warp, profile: Math.sin(t * Math.PI) };
}

export function createMaterials() {
  const n = noise2(7);
  const carbonNormal = normalFromHeight(256, 256, (x, y) => { const { warp, profile } = twill(x, y, 16); return profile * 0.8 + warp * 0.2; }, 1.6);
  const carbonMap = canvasTexture(256, 256, (x, y) => {
    const { warp, profile } = twill(x, y, 16);
    const v = 22 + profile * 10 + warp * 6 + n(x / 18, y / 18) * 3;
    return [v, v + 1, v + 3, 255];
  }, true);
  carbonMap.repeat.set(1, 6); carbonNormal.repeat.set(1, 6);
  const grain = normalFromHeight(256, 256, (x, y) => n(x / 3.1, y / 3.1, 2) * 0.6 + n(x / 11, y / 11) * 0.4, 0.9);
  grain.repeat.set(3, 3);
  // the same grain much finer, for moulded covers seen from close by
  const fineGrain = grain.clone();
  fineGrain.repeat.set(12, 12);
  const paintRough = canvasTexture(512, 512, (x, y) => {
    // long, soft streaks along the span plus fine mottling: no two metres look identical
    const v = 0.5 + n(x / 140, y / 6, 3) * 0.35 + n(x / 9, y / 9, 2) * 0.12;
    const g = 105 + v * 40;
    return [g, g, g, 255];
  }, false);

  const phys = (p: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(p);
  const drone: DroneMaterials = {
    // satin polymer: a fine grain under a thin clear layer, so studio lights draw clean highlights
    body: phys({ color: '#383e46', roughness: 0.46, metalness: 0, clearcoat: 0.32, clearcoatRoughness: 0.28, normalMap: fineGrain, normalScale: new THREE.Vector2(0.06, 0.06), envMapIntensity: 1.3 }),
    shell: phys({ color: '#4a5159', roughness: 0.36, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.16, normalMap: fineGrain, normalScale: new THREE.Vector2(0.04, 0.04), envMapIntensity: 1.35 }),
    light: phys({ color: '#747c85', roughness: 0.42, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.3, normalMap: fineGrain, normalScale: new THREE.Vector2(0.1, 0.1), envMapIntensity: 1.3 }),
    carbon: phys({ color: '#ffffff', map: carbonMap, roughness: 0.34, metalness: 0, clearcoat: 0.85, clearcoatRoughness: 0.16, normalMap: carbonNormal, normalScale: new THREE.Vector2(0.55, 0.55), envMapIntensity: 1.4 }),
    alu: phys({ color: '#a6adb4', roughness: 0.3, metalness: 1, envMapIntensity: 1.25 }),
    aluDark: phys({ color: '#50575f', roughness: 0.34, metalness: 1, envMapIntensity: 1.25 }),
    prop: phys({ color: '#141518', roughness: 0.44, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4 }),
    rubber: phys({ color: '#18191b', roughness: 0.88, metalness: 0 }),
    glass: phys({ color: '#06080b', roughness: 0.03, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6 }),
    // the lens coating reads blue-violet where it catches a light
    iris: phys({ color: '#1d2c5c', roughness: 0.14, metalness: 0.8, side: THREE.DoubleSide }),
    accent: phys({ color: '#0c4a80', roughness: 0.42, metalness: 0.1, clearcoat: 0.4, clearcoatRoughness: 0.3 }),
    ledRed: new THREE.MeshStandardMaterial({ color: '#2a0505', emissive: '#ff3322', emissiveIntensity: 1.6 }),
    ledGreen: new THREE.MeshStandardMaterial({ color: '#052a10', emissive: '#22ff66', emissiveIntensity: 1.3 }),
    ledWhite: new THREE.MeshStandardMaterial({ color: '#202428', emissive: '#e9f0ff', emissiveIntensity: 0.9 }),
    propDisc: new THREE.MeshBasicMaterial({ map: propDiscTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.9, toneMapped: true }),
  };

  // the paint roughness map multiplies `roughness`: 0.9 × (0.41–0.57) ≈ satin with soft variation
  const turbine = {
    blade: phys({ color: '#dfe3e7', vertexColors: true, roughness: 0.88, roughnessMap: paintRough, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.45 }),
    bladeEdge: phys({ color: '#cfd4d9', vertexColors: true, roughness: 0.5, metalness: 0 }),
    tower: phys({ color: '#d4d8dc', roughness: 0.98, roughnessMap: paintRough, metalness: 0.05, clearcoat: 0.15, clearcoatRoughness: 0.6 }),
    nacelle: phys({ color: '#dce0e4', roughness: 0.92, roughnessMap: paintRough, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.5 }),
    steel: phys({ color: '#8a9096', roughness: 0.45, metalness: 0.9 }),
    seam: phys({ color: '#aab0b7', roughness: 0.6, metalness: 0 }),
    receptor: phys({ color: '#4a5058', roughness: 0.4, metalness: 0.8 }),
    door: phys({ color: '#5d6670', roughness: 0.5, metalness: 0.6 }),
    concrete: new THREE.MeshStandardMaterial({ color: '#8d8a84', roughness: 0.95 }),
    lamp: new THREE.MeshStandardMaterial({ color: '#300606', emissive: '#ff2a1c', emissiveIntensity: 2.2 }),
    defect: new THREE.MeshStandardMaterial({ map: erosionTexture(), transparent: true, depthWrite: false, roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  };
  return { drone, turbine, terrain: terrainTexture() };
}

/**
 * Farmland seen from the air (one tile ≈ 670 m, 0.65 m per pixel): blocks bounded by
 * hedgerows or farm tracks, each split into long strips of grass, crops, ploughed soil or
 * stubble, with uneven growth inside every field. It tints the terrain's own colours.
 */
function terrainTexture() {
  const s = 1024, n = noise2(33), r = rng(9);
  const XS = [0, 0.23, 0.48, 0.7, 1], YS = [0, 0.26, 0.53, 0.77, 1];
  // grass, winter crop, ploughed soil, stubble, fallow
  const TINT = [[0.84, 0.97, 0.78], [0.72, 0.88, 0.68], [0.98, 0.85, 0.72], [1.08, 1.02, 0.84], [0.92, 0.94, 0.76]];
  const LUM = [0.92, 0.84, 0.76, 1.0, 0.9];
  const blocks = Array.from({ length: 16 }, () => {
    const w = Array.from({ length: 2 + Math.floor(r() * 4) }, () => 0.5 + r());
    const sum = w.reduce((a, b) => a + b, 0);
    let acc = 0;
    return { acrossU: r() < 0.5, cuts: w.map((x) => (acc += x / sum)), crops: w.map(() => Math.floor(r() * 5)), hedge: r() < 0.6 };
  });
  const cell = (edges: number[], t: number) => { let k = 0; while (k < edges.length - 2 && t >= edges[k + 1]) k++; return k; };
  const t = canvasTexture(s, s, (x, y) => {
    const u = (x + 0.5) / s, v = (y + 0.5) / s;
    const bi = cell(XS, u), bj = cell(YS, v), b = blocks[bj * 4 + bi];
    // strips cut across one axis of the block; find this pixel's strip
    const [lo, hi, at] = b.acrossU ? [XS[bi], XS[bi + 1], u] : [YS[bj], YS[bj + 1], v];
    const a = (at - lo) / (hi - lo);
    let k = 0;
    while (k < b.cuts.length - 1 && a >= b.cuts[k]) k++;
    const crop = b.crops[k];
    // distances in pixels to the block edge and to the strip edges
    const dBlock = Math.min(u - XS[bi], XS[bi + 1] - u, v - YS[bj], YS[bj + 1] - v) * s;
    const dStrip = Math.min(a - (k ? b.cuts[k - 1] : 0), b.cuts[k] - a) * (hi - lo) * s;
    const hedge = b.hedge ? 1 - smoothstep(remap(dBlock, 1.2, 3.4)) : 0;
    const track = b.hedge ? 0 : 1 - smoothstep(remap(dBlock, 0.6, 2.0));
    const border = 1 - smoothstep(remap(dStrip, 0.3, 1.3));
    const grain = n(u * 160, v * 160, 2) * 0.5 + 0.5;
    const growth = n(u * 11 + crop * 3.7, v * 11 - crop * 1.9, 3) * 0.5 + 0.5;
    const rows = crop === 2 || crop === 3 ? 0.035 * Math.sin(at * s * 1.05) : 0; // tilled rows along the strip
    const lum = LUM[crop] * (0.84 + 0.1 * grain + 0.12 * growth) + rows - 0.08 * border - 0.34 * hedge + 0.16 * track;
    const c = TINT[crop];
    return [Math.min(255, c[0] * lum * 215), Math.min(255, c[1] * lum * 215), Math.min(255, c[2] * lum * 215), 255];
  }, true);
  t.repeat.set(18, 18);
  return t;
}
export type Materials = ReturnType<typeof createMaterials>;

/** A spinning propeller seen by the eye: a faint disc, denser at the blade tips. */
function propDiscTexture() {
  const s = 256;
  return canvasTexture(s, s, (x, y) => {
    const dx = (x + 0.5) / s * 2 - 1, dy = (y + 0.5) / s * 2 - 1, r = Math.hypot(dx, dy);
    if (r > 1) return [0, 0, 0, 0];
    const a = (0.025 + 0.05 * r ** 2 + 0.1 * Math.exp(-(((r - 0.93) / 0.035) ** 2))) * (r > 0.12 ? 1 : 0);
    return [70, 76, 84, Math.round(a * 255)];
  }, true);
}

/** Leading-edge erosion: paint worn through to grey laminate, pitted, ragged borders. */
function erosionTexture() {
  const w = 512, h = 256, n = noise2(21), r = rng(5);
  const pits = Array.from({ length: 70 }, () => [r() * w, (0.3 + r() * 0.4) * h, 1 + r() * 4] as const);
  return canvasTexture(w, h, (x, y) => {
    const u = x / w, v = y / h;
    // strongest along the edge line (v ≈ 0.5), fading outboard and inboard
    const along = Math.sin(Math.PI * u) ** 0.6;
    const across = Math.exp(-(((v - 0.5) / 0.2) ** 2));
    const edge = n(x / 22, y / 22, 4) * 0.5 + 0.5;
    const m = along * across * 1.6 - 0.55 + (edge - 0.5) * 0.8;
    let a = Math.max(0, Math.min(1, m * 3));
    let g = 112 + n(x / 4, y / 4, 2) * 22; // exposed laminate
    for (const [px, py, pr] of pits) { const d = Math.hypot(x - px, y - py); if (d < pr) { g -= 38 * (1 - d / pr); a = Math.max(a, 0.9 * across); } }
    const rim = a > 0 && a < 0.35 ? 18 : 0; // lifted paint at the border
    return [g + rim, g + rim + 3, g + rim + 6, Math.round(a * 235)];
  }, true);
}
