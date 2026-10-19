// The scene for the cover proposals: the inspected turbine and the drone, no terrain and no
// repeated wind farm, lit by an afternoon sky and the sun. Models come from the current base
// (real-scale blade aerofoil, drone with gimbal); the blade's paint and the example erosion
// get close-up surfaces (surfaces.ts) because the covers look at them closely.
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
import { studioLighting } from './studio';
import { bladeSkin, erosionMaps, skinTransform, smearProps } from './surfaces';

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

export type PropLook = 'still' | 'smear';
/** A photographed sky (environment.ts) turned about +y; it carries its own sun. */
export interface RealSky { texture: THREE.Texture; rotation: number; intensity?: number }

/**
 * `studio`: the multi-page redesign's look — only the inspected blade (B) and the drone, lit
 * by studio softboxes in front of a deep navy backdrop (studio.ts); no tower, nacelle or sky.
 */
export function buildProposalScene({ sunDir = SUN_DIR, props = 'smear', sky, studio = false, lite = false }: { sunDir?: THREE.Vector3; props?: PropLook; sky?: RealSky; studio?: boolean; lite?: boolean } = {}) {
  const mats = createMaterials();
  const scene = new THREE.Scene();
  let sun: THREE.DirectionalLight | null = null;
  if (studio) {
    const light = studioLighting();
    scene.background = light.backdrop;
    scene.environment = light.environment;
  } else if (sky) {
    scene.background = sky.texture;
    scene.environment = sky.texture;
    scene.backgroundRotation.set(0, sky.rotation, 0);
    scene.environmentRotation.set(0, sky.rotation, 0);
    scene.backgroundIntensity = scene.environmentIntensity = sky.intensity ?? 1;
  } else {
    const procedural = skyTexture({ sun: sunDir, width: 4096 });
    scene.background = procedural;
    scene.environment = procedural;
    sun = new THREE.DirectionalLight(new THREE.Color(1, 0.93, 0.84), 3.4);
    sun.position.copy(sunDir).normalize().multiplyScalar(400);
    sun.target.position.set(0, 100, 0);
    scene.add(sun, sun.target);
  }

  // close-up paint: semi-gloss coating with its protection tape and wear (surfaces.ts), fine
  // orange peel in the top coat
  const peel = gelcoatNormal();
  peel.repeat.set(60, 3);
  // `lite`: coarser paint maps for quick raster previews
  const skin = bladeSkin(lite ? { w: 1024, h: 256 } : {});
  const blade = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', map: skinTransform(skin.map), roughness: 1, roughnessMap: skinTransform(skin.roughnessMap), metalness: 0,
    normalMap: skinTransform(skin.normalMap), normalScale: new THREE.Vector2(1, 1),
    clearcoat: 0.25, clearcoatRoughness: 0.22, clearcoatNormalMap: peel, clearcoatNormalScale: new THREE.Vector2(0.08, 0.08),
  });
  const wear = erosionMaps(39.2, 41.0, DEFECT.chord[0], DEFECT.chord[1]);
  const erosion = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', map: wear.map, transparent: true, depthWrite: false, roughness: 1, roughnessMap: wear.roughnessMap, metalness: 0,
    normalMap: wear.normalMap, normalScale: new THREE.Vector2(1, 1), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const m = mats.turbine;
  const g = new THREE.Group();
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material) => { const x = new THREE.Mesh(geo, mat); parent.add(x); return x; };
  if (!studio) {
    add(g, buildTowerGeometry(96), m.tower);
    const top = new THREE.Group();
    top.position.y = TURBINE.towerTop;
    add(top, buildNacelleGeometry(96), m.nacelle);
    add(top, buildNacelleDetails(), m.steel);
    add(top, buildNacelleSeams(), m.seam);
    for (const [x, y, z] of OBSTRUCTION_LIGHTS) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 12), m.lamp); l.position.set(x, y, z); top.add(l); }
    g.add(top);
  }
  const rotor = decompose(new THREE.Group(), rotorMatrix());
  if (!studio) add(rotor, buildSpinnerGeometry(96), m.nacelle);
  const geo = buildBladeGeometry({ ring: 144, spanScale: 2.5 });
  geo.surface.computeTangents();
  const receptors = buildReceptors();
  for (const id of studio ? (['B'] as const) : BLADES) {
    const b = decompose(new THREE.Group(), bladeMatrix(id));
    add(b, geo.surface, blade); add(b, geo.te, m.bladeEdge); add(b, receptors, m.receptor);
    if (id === DEFECT.blade) add(b, buildBladePatch(DEFECT.span[0], DEFECT.span[1], DEFECT.chord[0], DEFECT.chord[1], { nr: 48, nq: 96, offset: 0.002 }), erosion);
    // the same kind of wear on the upper blade, which the cover A inspects
    if (id === 'A') add(b, buildBladePatch(39.2, 41.0, DEFECT.chord[0], DEFECT.chord[1], { nr: 48, nq: 96, offset: 0.002 }), erosion);
    rotor.add(b);
  }
  g.add(rotor);
  scene.add(g);

  // the drone; its propellers smeared by the spin as a short shutter sees them, or still
  const drone: DroneRig = buildDrone(mats.drone, { ring: 64 });
  for (const pr of drone.props) pr.disc.removeFromParent();
  if (props === 'smear') smearProps(drone);
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
