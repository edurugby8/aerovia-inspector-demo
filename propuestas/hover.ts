// A hovering pose next to a blade, for stills: `hover=[A:|B:|C:]r,dy,dz,yawDeg,lookR,lookQ[,dx]`
// puts the drone dx m along +x, dy m above and dz m upwind of that blade's leading edge at span
// r (blade B if no prefix), heading yawDeg (180 = facing the rotor; `auto` = nose towards the
// point it inspects), with the gimbal on the same blade's surface at span lookR, loop parameter
// lookQ.
import * as THREE from 'three';
import { bladeSurfaceWorld, type BladeId } from '../src/experience/models/turbine';

export function parseHover(s: string | null) {
  if (!s) return undefined;
  const m = /^([ABC]):(.*)$/.exec(s);
  const id = (m ? m[1] : 'B') as BladeId;
  const [r, dy, dz, yaw, lr, lq, dx = 0] = (m ? m[2] : s).split(',').map(Number);
  const position = bladeSurfaceWorld(id, r, 0.5).add(new THREE.Vector3(dx, dy, dz));
  const look = bladeSurfaceWorld(id, lr, lq);
  return {
    position,
    yaw: Number.isFinite(yaw) ? THREE.MathUtils.degToRad(yaw) : Math.atan2(look.x - position.x, look.z - position.z),
    look,
  };
}
