// A hovering pose next to blade B, for stills: `hover=r,dy,dz,yawDeg,lookR,lookQ` puts the drone
// dy m above and dz m upwind of the leading edge at span r, heading yawDeg (180 = facing the
// blade), with the gimbal on the blade surface at span lookR, loop parameter lookQ.
import * as THREE from 'three';
import { bladeSurfaceWorld } from '../src/experience/models/turbine';

export function parseHover(s: string | null) {
  if (!s) return undefined;
  const [r, dy, dz, yaw, lr, lq] = s.split(',').map(Number);
  return {
    position: bladeSurfaceWorld('B', r, 0.5).add(new THREE.Vector3(0, dy, dz)),
    yaw: THREE.MathUtils.degToRad(yaw),
    look: bladeSurfaceWorld('B', lr, lq),
  };
}
