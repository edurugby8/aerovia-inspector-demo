// Turns a camera (no roll) so that a world point lands at a chosen place on screen.
import * as THREE from 'three';

/** sx, sy: 0…1 from the left and from the top of the frame. */
export function aimAt(camera: THREE.PerspectiveCamera, target: THREE.Vector3, sx: number, sy: number) {
  camera.up.set(0, 1, 0);
  camera.lookAt(target);
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  e.z = 0;
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), tanH = tanV * camera.aspect;
  const n = new THREE.Vector3();
  for (let i = 0; i < 40; i++) {
    camera.quaternion.setFromEuler(e);
    camera.updateMatrixWorld();
    n.copy(target).project(camera);
    const ex = 2 * sx - 1 - n.x, ey = 1 - 2 * sy - n.y;
    if (Math.abs(ex) + Math.abs(ey) < 1e-5) break;
    e.y += Math.atan(ex * tanH) * 0.8;
    e.x -= Math.atan(ey * tanV) * 0.8;
  }
  camera.updateMatrixWorld();
}
