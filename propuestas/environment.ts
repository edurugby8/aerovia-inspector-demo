// The real sky for the proposals: Poly Haven's «Evening Road 01 (Pure Sky)» (CC0), fetched by
// scripts/descargar-hdri.mjs into propuestas/hdri/ (not committed). Loads it as an equirect
// environment and finds its sun, so a framing can turn the sky to bring the sun where the
// composition needs it.
import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

export const HDRI_FILE = `${import.meta.env.BASE_URL}propuestas/hdri/evening_road_01_puresky_4k.hdr`;

export interface Sky {
  texture: THREE.DataTexture;
  /** direction towards the sun with no rotation applied (three's equirect convention) */
  sun: THREE.Vector3;
  /** degrees above the horizon */
  sunElevation: number;
}

/** Direction for equirect uv (u from the left, v from the bottom), as three's equirectUv maps them. */
export function equirectDirection(u: number, v: number, out = new THREE.Vector3()) {
  const phi = (u - 0.5) * 2 * Math.PI, lat = (v - 0.5) * Math.PI;
  return out.set(Math.cos(phi) * Math.cos(lat), Math.sin(lat), Math.sin(phi) * Math.cos(lat));
}

export async function loadSky(url = HDRI_FILE): Promise<Sky> {
  const texture = (await new HDRLoader().setDataType(THREE.FloatType).loadAsync(url)) as THREE.DataTexture;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  const { width: W, height: H, data } = texture.image as { width: number; height: number; data: Float32Array };
  // the sun: the luminance-weighted centre of the brightest texels
  let best = 0;
  const lum = (i: number) => 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
  for (let i = 0; i < W * H; i++) best = Math.max(best, lum(i));
  const sum = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i < W * H; i++) {
    const l = lum(i);
    if (l < best * 0.25) continue;
    const x = i % W, y = Math.floor(i / W);
    // row 0 of the texture data is v = 0 when flipY is false, the top of the image when it is true
    const v = texture.flipY ? 1 - (y + 0.5) / H : (y + 0.5) / H;
    sum.addScaledVector(equirectDirection((x + 0.5) / W, v, d), l);
  }
  const sun = sum.normalize();
  return { texture, sun, sunElevation: THREE.MathUtils.radToDeg(Math.asin(sun.y)) };
}

/**
 * The rotation about +y (radians, for scene.environmentRotation / backgroundRotation) that turns
 * the sky's sun to the given world azimuth (radians from +z towards +x).
 */
export function rotationFor(sky: Sky, azimuth: number) {
  return azimuth - Math.atan2(sky.sun.x, sky.sun.z);
}

/**
 * The page's sky from its query: `sky=hdri` loads the HDRI, `skyaz` puts its sun at that azimuth
 * (degrees from +z towards +x; default 23.6, the procedural sun of the covers), `skyexp` scales it.
 */
export async function skyFromQuery(q: URLSearchParams) {
  if (q.get('sky') !== 'hdri') return undefined;
  const sky = await loadSky();
  return {
    texture: sky.texture,
    rotation: rotationFor(sky, THREE.MathUtils.degToRad(Number(q.get('skyaz') ?? 23.6))),
    intensity: Number(q.get('skyexp') ?? 1),
  };
}
