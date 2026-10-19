// The studio for the multi-page redesign: one blade and the drone in front of a deep navy
// backdrop, lit like a product shot. Two float equirect maps drawn here (no downloaded files),
// in three.js's equirect convention (row 0 looks straight down):
// - the lighting: a large soft key above and in front of the subject, two narrow rim strips
//   behind it that draw its edges against the dark, a weak cool fill from below and a faint top
//   light, over a dark navy surround;
// - the backdrop the camera sees: navy with a broad, faint glow behind the subject, so the
//   softboxes light the scene and show in its reflections but never in frame.
import * as THREE from 'three';

const smooth = (a: number, b: number, t: number) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };

/** A rectangular softbox seen from the subject: centre direction and its frame, half-size in degrees, colour. */
interface Softbox { dir: THREE.Vector3; right: THREE.Vector3; up: THREE.Vector3; halfW: number; halfH: number; color: [number, number, number]; soft: number }

function box(az: number, el: number, halfW: number, halfH: number, color: [number, number, number], soft = 4): Softbox {
  const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
  // azimuth measured from +z towards +x, like the scene's sun azimuths
  const dir = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
  const right = new THREE.Vector3(0, 1, 0).cross(dir);
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
  right.normalize();
  return { dir, right, up: dir.clone().cross(right).normalize(), halfW, halfH, color, soft };
}

/** The lights of the studio. Azimuths from +z (upwind of the rotor, where the cameras stand) towards +x. */
export const STUDIO = {
  surround: [0.006, 0.011, 0.022] as [number, number, number],
  boxes: [
    box(15, 62, 4.5, 4.5, [70, 67, 62], 1.2), // top key: small and strong, so the drone casts a readable shadow on the blade
    box(-30, 34, 24, 14, [3.2, 3.1, 2.95], 6), // big soft key, front left
    box(-95, 16, 5, 28, [9, 9.4, 10], 2.5), // rim strip towards the tip: edges of drone and blade from the root side
    box(-160, 24, 5, 28, [7, 7.5, 8.5], 2.5), // rim strip behind the blade
    box(95, 20, 5, 24, [4, 4.2, 4.6], 2.5), // rim strip towards the root
    box(40, -18, 34, 14, [0.3, 0.4, 0.65], 10), // cool fill from below, front right
  ] as Softbox[],
  /** backdrop: deep navy, a little lighter in a broad glow behind the subject as the cover sees it */
  backdrop: { base: [0.0038, 0.0078, 0.0165] as [number, number, number], glow: [0.011, 0.019, 0.036] as [number, number, number], glowDir: new THREE.Vector3(-0.85, -0.2, -0.48).normalize(), glowWidth: 0.7 },
};

function equirect(w: number, shade: (d: THREE.Vector3, out: number[]) => void) {
  const h = w / 2, data = new Float32Array(w * h * 4), d = new THREE.Vector3(), c = [0, 0, 0];
  for (let y = 0; y < h; y++) {
    const el = ((y + 0.5) / h - 0.5) * Math.PI, sy = Math.sin(el), cy = Math.cos(el);
    for (let x = 0; x < w; x++) {
      const az = ((x + 0.5) / w - 0.5) * Math.PI * 2;
      d.set(cy * Math.cos(az), sy, cy * Math.sin(az));
      shade(d, c);
      const i = (y * w + x) * 4;
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 1;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/** How much of a softbox covers direction d (0…1), with soft edges. */
function coverage(b: Softbox, d: THREE.Vector3) {
  const c = d.dot(b.dir);
  if (c <= 0) return 0;
  // angular offsets from the box centre, horizontally (about +y) and vertically
  const ax = THREE.MathUtils.radToDeg(Math.atan2(d.dot(b.right), c)), ay = THREE.MathUtils.radToDeg(Math.atan2(d.dot(b.up), c));
  return smooth(b.halfW + b.soft, b.halfW - b.soft, Math.abs(ax)) * smooth(b.halfH + b.soft, b.halfH - b.soft, Math.abs(ay));
}

export function studioLighting(width = 2048) {
  const environment = equirect(width, (d, out) => {
    out[0] = STUDIO.surround[0]; out[1] = STUDIO.surround[1]; out[2] = STUDIO.surround[2];
    for (const b of STUDIO.boxes) {
      const k = coverage(b, d);
      if (k > 0) { out[0] += b.color[0] * k; out[1] += b.color[1] * k; out[2] += b.color[2] * k; }
    }
  });
  const { base, glow, glowDir, glowWidth } = STUDIO.backdrop;
  const backdrop = equirect(1024, (d, out) => {
    const g = Math.exp(-(((1 - d.dot(glowDir)) / (glowWidth * 0.5)) ** 1.2));
    const fall = 0.75 + 0.25 * smooth(-0.6, 0.2, d.y); // a touch darker low down
    for (let k = 0; k < 3; k++) out[k] = (base[k] + glow[k] * g) * fall;
  });
  return { environment, backdrop };
}
