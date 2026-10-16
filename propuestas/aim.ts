// Turns a camera so that a world point lands at a chosen place on screen, with an optional roll
// (radians, positive turns the picture clockwise; with only sky behind, a gentle roll is not read
// as a tilted horizon).
import * as THREE from 'three';

/** sx, sy: 0…1 from the left and from the top of the frame. */
export function aimAt(camera: THREE.PerspectiveCamera, target: THREE.Vector3, sx: number, sy: number, roll = 0) {
  camera.up.set(0, 1, 0);
  camera.lookAt(target);
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  e.z = 0;
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), tanH = tanV * camera.aspect;
  // aim the unrolled camera at the spot the roll then carries to (sx, sy)
  const u = (2 * sx - 1) * tanH, v = (1 - 2 * sy) * tanV, c = Math.cos(roll), s = Math.sin(roll);
  const tx = (c * u - s * v) / tanH, ty = (s * u + c * v) / tanV;
  const n = new THREE.Vector3();
  for (let i = 0; i < 40; i++) {
    camera.quaternion.setFromEuler(e);
    camera.updateMatrixWorld();
    n.copy(target).project(camera);
    const ex = tx - n.x, ey = ty - n.y;
    if (Math.abs(ex) + Math.abs(ey) < 1e-5) break;
    e.y += Math.atan(ex * tanH) * 0.8;
    e.x -= Math.atan(ey * tanV) * 0.8;
  }
  if (roll) camera.rotateZ(roll);
  camera.updateMatrixWorld();
}
