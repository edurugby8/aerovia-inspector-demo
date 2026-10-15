// The scene for the cover proposals: the inspected turbine and the drone, no terrain and no
// repeated wind farm, lit by a late-afternoon sky and a low sun. Models come from the
// current base (real-scale blade aerofoil, drone with gimbal); the blade's paint gets a
// close-up surface (gelcoat sheen, fine orange peel) because the covers look at it closely.
import * as THREE from 'three';
import { createMaterials } from '../src/experience/materials';
import { noise2 } from '../src/experience/math';
import { buildDrone, type DroneRig } from '../src/experience/models/drone';
import {
  BLADES, DEFECT, OBSTRUCTION_LIGHTS, TURBINE, bladeMatrix, buildBladeGeometry, buildBladePatch, buildNacelleDetails, buildNacelleGeometry,
  buildNacelleSeams, buildReceptors, buildSpinnerGeometry, buildTowerGeometry, rotorMatrix,
} from '../src/experience/models/turbine';
import { droneState, gimbalAngles, gimbalTarget } from '../src/experience/trajectory';
import { skyTexture } from './sky';

/** Towards the sun: low (≈13°), in front of the rotor and a little to the side of blade B. */
export const SUN_DIR = new THREE.Vector3(-0.35, 0.22, 0.91).normalize();

function decompose(obj: THREE.Object3D, m: THREE.Matrix4) { m.decompose(obj.position, obj.quaternion, obj.scale); return obj; }

/** Fine orange peel on the gelcoat plus slow waviness of the moulded shell, as a normal map. */
function gelcoatNormal() {
  const s = 1024, n = noise2(41);
  const H = new Float32Array(s * s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const u = x / s, v = y / s;
    H[y * s + x] = 0.65 * n(u * 90, v * 90, 3) + 0.35 * n(u * 9 + 3, v * 9 - 2, 2);
  }
  const at = (x: number, y: number) => H[((y + s) % s) * s + ((x + s) % s)];
  const data = new Uint8Array(s * s * 4), k = 1.4;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * k, dy = (at(x, y + 1) - at(x, y - 1)) * k, l = Math.hypot(dx, dy, 1), i = (y * s + x) * 4;
    data[i] = (-dx / l * 0.5 + 0.5) * 255; data[i + 1] = (dy / l * 0.5 + 0.5) * 255; data[i + 2] = (1 / l * 0.5 + 0.5) * 255; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, s, s, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8; t.needsUpdate = true;
  return t;
}

export function buildProposalScene() {
  const mats = createMaterials();
  const scene = new THREE.Scene();
  const sky = skyTexture({ sun: SUN_DIR, width: 4096 });
  scene.background = sky;
  scene.environment = sky;

  const sun = new THREE.DirectionalLight(new THREE.Color(1, 0.93, 0.84), 3.4);
  sun.position.copy(SUN_DIR).multiplyScalar(400);
  sun.target.position.set(0, 100, 0);
  scene.add(sun, sun.target);

  // close-up paint: satin gelcoat with a clear sheen, fine texture along the span
  const peel = gelcoatNormal();
  peel.repeat.set(60, 3);
  const blade = new THREE.MeshPhysicalMaterial({
    color: '#e8eaec', vertexColors: true, roughness: 0.4, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.24,
    normalMap: peel, normalScale: new THREE.Vector2(0.04, 0.04),
  });
  const m = mats.turbine;
  const g = new THREE.Group();
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material) => { const x = new THREE.Mesh(geo, mat); parent.add(x); return x; };
  add(g, buildTowerGeometry(96), m.tower);
  const top = new THREE.Group();
  top.position.y = TURBINE.towerTop;
  add(top, buildNacelleGeometry(96), m.nacelle);
  add(top, buildNacelleDetails(), m.steel);
  add(top, buildNacelleSeams(), m.seam);
  for (const [x, y, z] of OBSTRUCTION_LIGHTS) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 12), m.lamp); l.position.set(x, y, z); top.add(l); }
  g.add(top);
  const rotor = decompose(new THREE.Group(), rotorMatrix());
  add(rotor, buildSpinnerGeometry(96), m.nacelle);
  const geo = buildBladeGeometry({ ring: 144, spanScale: 2.5 });
  geo.surface.computeTangents();
  const receptors = buildReceptors();
  for (const id of BLADES) {
    const b = decompose(new THREE.Group(), bladeMatrix(id));
    add(b, geo.surface, blade); add(b, geo.te, m.bladeEdge); add(b, receptors, m.receptor);
    if (id === DEFECT.blade) add(b, buildBladePatch(DEFECT.span[0], DEFECT.span[1], DEFECT.chord[0], DEFECT.chord[1], { nr: 48, nq: 48, offset: 0.003 }), m.defect);
    rotor.add(b);
  }
  g.add(rotor);
  scene.add(g);

  // the drone with still propellers (no motion blur discs in a still image)
  const drone: DroneRig = buildDrone(mats.drone, { ring: 64 });
  for (const pr of drone.props) pr.disc.removeFromParent();
  scene.add(drone.root);
  const qYaw = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  /**
   * Pose the drone (and its stabilised gimbal) as it is at scroll progress p, or hovering
   * level at a given place, heading `yaw` and looking at `look`.
   */
  function poseDrone(p: number, hover?: { position: THREE.Vector3; yaw: number; look: THREE.Vector3 }) {
    const st = droneState(p);
    if (hover) {
      st.position.copy(hover.position);
      st.yaw = hover.yaw;
      st.quaternion.setFromAxisAngle(Y, hover.yaw);
    }
    drone.root.position.copy(st.position);
    drone.root.quaternion.copy(st.quaternion);
    const target = hover ? hover.look.clone() : gimbalTarget(p, st.position, st.yaw);
    const ang = gimbalAngles(st.position, target, st.yaw);
    qYaw.setFromAxisAngle(Y, st.yaw + ang.yaw);
    drone.gimbalYaw.quaternion.copy(st.quaternion).invert().multiply(qYaw);
    drone.gimbalPitch.rotation.x = ang.pitch;
    for (const [i, pr] of drone.props.entries()) pr.node.rotation.y = i * 1.3 + 0.4;
    drone.root.updateMatrixWorld(true);
    return { position: st.position.clone(), target };
  }
  return { scene, drone, poseDrone, sun };
}
