// The inspection's second moment in the studio, for the sample clip: the drone travels along
// blade B from 50 m to 44.6 m from the hub, 3.6 m above and 2.4 m upwind of the leading edge
// (about 4.3 m from it), its camera on the blade just ahead of it; the camera of the shot
// follows beside it, so the blade surface slides past underneath.
import * as THREE from 'three';
import { bladeSurfaceWorld } from '../src/experience/models/turbine';

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const STANDOFF = new THREE.Vector3(0, 3.6, 2.4);

export const STUDIO_PASS = {
  span: [50, 44.6] as const,
  /** where the gimbal looks: a little ahead of the drone on the nose, ending on the worn spot */
  look: [[48.8, 0.48], [44, 0.47]] as const,
  /** the shot's camera around the drone: azimuth from +z towards +x and elevation (deg), distance (m) */
  around: [[55, 22, 3.6], [45, 24, 3.4]] as const,
  aim: [[0.62, 0.36], [0.58, 0.36]] as const,
  fov: 44,
};

export function studioPoseAt(t: number) {
  const e = ease(Math.min(1, Math.max(0, t))), P = STUDIO_PASS;
  const drone = bladeSurfaceWorld('B', lerp(P.span[0], P.span[1], e), 0.5).add(STANDOFF);
  const look = bladeSurfaceWorld('B', lerp(P.look[0][0], P.look[1][0], e), lerp(P.look[0][1], P.look[1][1], e));
  const [az, el, d] = [0, 1, 2].map((k) => lerp(P.around[0][k], P.around[1][k], e));
  const a = THREE.MathUtils.degToRad(az), b = THREE.MathUtils.degToRad(el);
  const camera = drone.clone().add(new THREE.Vector3(Math.sin(a) * Math.cos(b), Math.sin(b), Math.cos(a) * Math.cos(b)).multiplyScalar(d));
  return {
    drone, look, camera, fov: P.fov, roll: 0,
    aim: [lerp(P.aim[0][0], P.aim[1][0], e), lerp(P.aim[0][1], P.aim[1][1], e)] as [number, number],
  };
}
