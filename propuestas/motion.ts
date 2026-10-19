// The short motion test for cover A: from the cover framing, the camera pushes in and swings a
// little upwind while the drone climbs a metre and a half along blade A, its gimbal held on the
// worn spot of the leading edge. poseAt(t) eases between the two ends.
import * as THREE from 'three';
import { bladeSurfaceWorld } from '../src/experience/models/turbine';

/** The drone: span on blade A, then metres up, upwind and along +x from that leading-edge point. */
export interface DronePlace { r: number; dy: number; dz: number; dx: number }
interface Framing { drone: DronePlace; fov: number; rollDeg: number; aim: [number, number] }

export const LOOK = { r: 40.1, q: 0.47 }; // the worn spot the gimbal holds
export const SUN = new THREE.Vector3(0.35, 0.5, 0.8).normalize();

/** Cover A on desktop: the drone at the leading edge, the blade crossing the frame. */
export const COVER: Framing & { camera: THREE.Vector3 } = {
  drone: { r: 38.04, dy: -1.27, dz: 0.62, dx: 4.45 }, camera: new THREE.Vector3(30.5, 129.17, 6.21),
  fov: 24, rollDeg: 14, aim: [0.609, 0.533],
};
/** Cover A on mobile: same moment, a portrait framing of its own. */
export const COVER_MOBILE: Framing & { camera: THREE.Vector3 } = {
  ...COVER, camera: new THREE.Vector3(30.11, 128.58, 6.31), fov: 34.3, rollDeg: 10.2, aim: [0.411, 0.463],
};
/** Where the test ends: closer, a little upwind, the drone 3.8 m off the blade face. */
export const END: Framing & { distance: number; swingDeg: number } = {
  drone: { r: 39.4, dy: -0.7, dz: 0.9, dx: 3.95 }, distance: 5.6, swingDeg: 18,
  fov: 30, rollDeg: 9, aim: [0.56, 0.58],
};

export function dronePosition(d: DronePlace, out = new THREE.Vector3()) {
  return out.copy(bladeSurfaceWorld('A', d.r, 0.5)).add(new THREE.Vector3(d.dx, d.dy, d.dz));
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Drone, gimbal target and camera at t ∈ [0, 1] of the test, from a cover framing. */
export function poseAt(t: number, start = COVER) {
  const e = ease(Math.min(1, Math.max(0, t)));
  const d0 = dronePosition(start.drone);
  const dir0 = start.camera.clone().sub(d0), dist0 = dir0.length();
  dir0.normalize();
  // turning about +y by a negative angle swings the camera towards +z, upwind of the blade
  const dir1 = dir0.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(-END.swingDeg));
  const k = (key: keyof DronePlace) => lerp(start.drone[key], END.drone[key], e);
  const drone = dronePosition({ r: k('r'), dy: k('dy'), dz: k('dz'), dx: k('dx') });
  const camera = drone.clone().addScaledVector(dir0.clone().lerp(dir1, e).normalize(), lerp(dist0, END.distance, e));
  return {
    drone, look: bladeSurfaceWorld('A', LOOK.r, LOOK.q), camera,
    fov: lerp(start.fov, END.fov, e),
    roll: THREE.MathUtils.degToRad(lerp(start.rollDeg, END.rollDeg, e)),
    aim: [lerp(start.aim[0], END.aim[0], e), lerp(start.aim[1], END.aim[1], e)] as [number, number],
  };
}
