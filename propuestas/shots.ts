// Camera placements for the two cover proposals, relative to the drone pose and the turbine.
import * as THREE from 'three';
import { bladeSurfaceWorld } from '../src/experience/models/turbine';
import { HUB } from '../src/experience/trajectory';

export type ShotName = 'a' | 'b';
export type Format = 'wide' | 'tall';
type Pose = { position: THREE.Vector3; target: THREE.Vector3 };
type Shot = { p: number; fov: number; exposure: number; camera: (pose: Pose) => { position: THREE.Vector3; look: THREE.Vector3 } };

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const SHOTS: Record<ShotName, Record<Format, Shot>> = {
  // A · industrial detail: close to the leading edge, the drone hovering over the blade
  a: {
    wide: { p: 0.63, fov: 30, exposure: 1, camera: (d) => ({ position: d.position.clone().add(v(8, -2.5, 9)), look: bladeSurfaceWorld('B', 44, 0.5).lerp(d.position, 0.5) }) },
    tall: { p: 0.63, fov: 44, exposure: 1, camera: (d) => ({ position: d.position.clone().add(v(6, -2, 8)), look: bladeSurfaceWorld('B', 44, 0.5).lerp(d.position, 0.5) }) },
  },
  // B · inspection in context: behind the drone, the blade leading back to the hub
  b: {
    wide: { p: 0.63, fov: 36, exposure: 1, camera: (d) => ({ position: d.position.clone().add(v(-14, 1.5, 12)), look: d.position.clone().lerp(HUB, 0.3) }) },
    tall: { p: 0.63, fov: 50, exposure: 1, camera: (d) => ({ position: d.position.clone().add(v(-12, 1.5, 10)), look: d.position.clone().lerp(HUB, 0.3) }) },
  },
};
