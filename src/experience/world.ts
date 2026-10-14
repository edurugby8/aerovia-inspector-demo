// The whole 3D world, built imperatively and updated from the scroll progress. Shared by
// the web page (through React Three Fiber) and by the script that renders the stills.
import * as THREE from 'three';
import { createMaterials } from './materials';
import { lerp, remap, smoothstep } from './math';
import { buildDrone, type DroneRig } from './models/drone';
import { merge } from './models/geometry';
import { buildRidge, buildSiteGeometry, buildTerrain, windFarm } from './models/landscape';
import {
  BLADES, DEFECT, OBSTRUCTION_LIGHTS, TURBINE, bladeMatrix, buildBladeGeometry, buildBladePatch, buildNacelleDetails, buildNacelleSeams, buildReceptors,
  buildNacelleGeometry, buildSpinnerGeometry, buildTowerBase, buildTowerGeometry, rotorMatrix,
} from './models/turbine';
import { annotations, type Annotations, type ScreenPoint } from './store';
import { annotations as annotationLevels, cameraPose, captureFrame, defectPoint, droneState, fitFov, gimbalAngles, gimbalTarget, HUB, type Layout } from './trajectory';

/** Direction towards the key light: low, from the west side, a little in front of the rotor. */
export const SUN = new THREE.Vector3(-0.82, 0.42, 0.38).normalize();
/** Behind the subject as seen in the presentation, a little to the right. */
const RIM = new THREE.Vector3(0.11, 0.35, -1.16).normalize();
const SKY = { zenith: '#06132a', upper: '#123158', horizon: '#57789a', glow: '#c2bdb4', ground: '#18222d' };
export type Quality = 'high' | 'low';

function skyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      zenith: { value: new THREE.Color(SKY.zenith) }, upper: { value: new THREE.Color(SKY.upper) },
      horizon: { value: new THREE.Color(SKY.horizon) }, glow: { value: new THREE.Color(SKY.glow) },
      ground: { value: new THREE.Color(SKY.ground) }, sun: { value: SUN.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 zenith; uniform vec3 upper; uniform vec3 horizon; uniform vec3 glow; uniform vec3 ground; uniform vec3 sun;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float e = d.y;
        vec3 col = mix(horizon, upper, smoothstep(0.0, 0.22, e));
        col = mix(col, zenith, smoothstep(0.18, 0.9, e));
        float toward = max(0.0, dot(normalize(d.xz + 1e-5), normalize(sun.xz)));
        col += glow * pow(toward, 4.0) * exp(-max(e, 0.0) * 11.0) * 0.5;
        col = mix(col, ground, smoothstep(0.0, -0.06, e));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
}

type Mats = ReturnType<typeof createMaterials>;

function decompose(obj: THREE.Object3D, m: THREE.Matrix4) {
  m.decompose(obj.position, obj.quaternion, obj.scale);
  return obj;
}

function buildInspectedTurbine(m: Mats['turbine'], q: Quality) {
  const g = new THREE.Group();
  g.name = 'turbine';
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, cast = true) => {
    const x = new THREE.Mesh(geo, mat); x.castShadow = cast; x.receiveShadow = true; return x;
  };
  g.add(mesh(buildTowerGeometry(q === 'high' ? 72 : 40), m.tower));
  g.add(mesh(buildTowerBase(), m.door));
  const foundation = mesh(new THREE.CylinderGeometry(3.3, 3.5, 0.6, 48), m.concrete, false);
  foundation.position.y = -0.12;
  g.add(foundation);
  const top = new THREE.Group();
  top.position.y = TURBINE.towerTop;
  top.add(mesh(buildNacelleGeometry(q === 'high' ? 64 : 36), m.nacelle));
  top.add(mesh(buildNacelleDetails(), m.steel));
  top.add(mesh(buildNacelleSeams(), m.seam, false));
  const lamps: THREE.Mesh[] = [];
  for (const [x, y, z] of OBSTRUCTION_LIGHTS) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10), m.lamp); l.position.set(x, y, z); top.add(l); lamps.push(l); }
  g.add(top);
  const rotor = decompose(new THREE.Group(), rotorMatrix());
  rotor.add(mesh(buildSpinnerGeometry(q === 'high' ? 72 : 40), m.nacelle));
  const blade = buildBladeGeometry({ ring: q === 'high' ? 72 : 48, spanScale: q === 'high' ? 1 : 0.7 });
  const receptors = buildReceptors();
  for (const id of BLADES) {
    const b = decompose(new THREE.Group(), bladeMatrix(id));
    b.name = `blade-${id}`;
    b.add(mesh(blade.surface, m.blade), mesh(blade.te, m.bladeEdge), mesh(receptors, m.receptor, false));
    if (id === DEFECT.blade) {
      const patch = new THREE.Mesh(buildBladePatch(DEFECT.span[0], DEFECT.span[1], DEFECT.chord[0], DEFECT.chord[1]), m.defect);
      patch.renderOrder = 1;
      b.add(patch);
    }
    rotor.add(b);
  }
  g.add(rotor);
  return { group: g, lamps };
}

/** Distant turbines: two merged meshes each (stationary parts, rotor), sharing geometry. */
function buildFarm(lampMat: THREE.Material) {
  const mat = new THREE.MeshStandardMaterial({ color: '#c9ced3', roughness: 0.6, metalness: 0 });
  const fixed = merge([
    buildTowerGeometry(14),
    buildNacelleGeometry(16).translate(0, TURBINE.towerTop, 0),
    buildSpinnerGeometry(14).applyMatrix4(rotorMatrix()),
  ]);
  const { surface } = buildBladeGeometry({ ring: 14, spanScale: 0.25, colors: false });
  const rotorGeo = merge(BLADES.map((id) => surface.clone().applyMatrix4(bladeMatrix(id, THREE.MathUtils.degToRad(2)))));
  const lampGeo = new THREE.SphereGeometry(0.9, 8, 6);
  const group = new THREE.Group();
  const spins: { node: THREE.Object3D; phase: number; rpm: number }[] = [];
  const lamps: THREE.Mesh[] = [];
  for (const t of windFarm()) {
    const tg = new THREE.Group();
    tg.position.set(t.x, t.y, t.z);
    tg.scale.setScalar(t.scale);
    tg.add(new THREE.Mesh(fixed, mat));
    const rotor = decompose(new THREE.Group(), rotorMatrix());
    const spin = new THREE.Group();
    spin.rotation.z = -t.phase;
    spin.add(new THREE.Mesh(rotorGeo, mat));
    rotor.add(spin);
    tg.add(rotor);
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(0, TURBINE.towerTop + 5.6, -6.6);
    tg.add(lamp);
    lamps.push(lamp);
    group.add(tg);
    spins.push({ node: spin, phase: t.phase, rpm: t.rpm });
  }
  return { group, spins, lamps };
}

/** Viewfinder corners at the capture zone, plus faint lines back to the payload lens. */
function buildCaptureFrame() {
  const corners = new THREE.BufferGeometry();
  corners.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
  const cornerMat = new THREE.LineBasicMaterial({ color: '#dbe9ff', transparent: true, opacity: 0, depthWrite: false });
  const frustum = new THREE.BufferGeometry();
  frustum.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
  const frustumMat = new THREE.LineBasicMaterial({ color: '#9fc3ec', transparent: true, opacity: 0, depthWrite: false });
  const a = new THREE.LineSegments(corners, cornerMat), b = new THREE.LineSegments(frustum, frustumMat);
  a.frustumCulled = b.frustumCulled = false;
  a.renderOrder = b.renderOrder = 3;
  const group = new THREE.Group();
  group.add(a, b);
  const set = (lens: THREE.Vector3, q: THREE.Vector3[], opacity: number) => {
    const P = corners.getAttribute('position') as THREE.BufferAttribute;
    let k = 0;
    for (let i = 0; i < 4; i++) {
      const c = q[i], prev = q[(i + 3) % 4], next = q[(i + 1) % 4];
      for (const o of [prev, next]) {
        const end = c.clone().lerp(o, 0.22);
        P.setXYZ(k++, c.x, c.y, c.z); P.setXYZ(k++, end.x, end.y, end.z);
      }
    }
    P.needsUpdate = true;
    const F = frustum.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < 4; i++) { F.setXYZ(i * 2, lens.x, lens.y, lens.z); F.setXYZ(i * 2 + 1, q[i].x, q[i].y, q[i].z); }
    F.needsUpdate = true;
    cornerMat.opacity = 0.85 * opacity;
    frustumMat.opacity = 0.16 * opacity;
    group.visible = opacity > 0.001;
  };
  return { group, set };
}

export type World = ReturnType<typeof createWorld>;

export function createWorld({ quality = 'high' as Quality } = {}) {
  const mats = createMaterials();
  const scene = new THREE.Group();

  const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 48, 24), skyMaterial());
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);

  // cold key from the side, soft sky fill, and a faint cool rim from the brighter horizon behind
  const key = new THREE.DirectionalLight('#dde7f6', 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
  key.shadow.bias = -0.00015;
  key.shadow.normalBias = 0.015;
  scene.add(key, key.target);
  scene.add(new THREE.HemisphereLight('#6c88ad', '#2a323a', 0.6));
  const rim = new THREE.DirectionalLight('#a9c2e2', 0.9);
  rim.position.copy(RIM).multiplyScalar(500);
  scene.add(rim);

  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: mats.terrain, roughness: 0.97, metalness: 0 });
  const terrain = new THREE.Mesh(buildTerrain({ segments: quality === 'high' ? 300 : 180 }), terrainMat);
  terrain.receiveShadow = true;
  scene.add(terrain);
  const site = buildSiteGeometry();
  const pad = new THREE.Mesh(site.pad, new THREE.MeshStandardMaterial({ color: '#6c6862', roughness: 1 }));
  const track = new THREE.Mesh(site.track, new THREE.MeshStandardMaterial({ color: '#5d5a54', roughness: 1 }));
  pad.receiveShadow = track.receiveShadow = true;
  scene.add(pad, track);
  // two bands of distant hills, coloured for their distance (aerial perspective) rather than fogged out
  for (const [radius, height, seed, color] of [[6800, 260, 4, '#3a526c'], [9200, 520, 7, '#476280']] as const) {
    const ridge = new THREE.Mesh(buildRidge(radius, height, seed), new THREE.MeshBasicMaterial({ color, fog: false, side: THREE.DoubleSide }));
    scene.add(ridge);
  }

  const turbine = buildInspectedTurbine(mats.turbine, quality);
  scene.add(turbine.group);
  const farm = buildFarm(mats.turbine.lamp);
  scene.add(farm.group);

  const drone: DroneRig = buildDrone(mats.drone, { ring: quality === 'high' ? 44 : 28 });
  // its box in its own frame (built at the origin), propellers included: its outline on screen
  const droneBox = new THREE.Box3().setFromObject(drone.root, true);
  const droneCorners = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(
    i & 1 ? droneBox.max.x : droneBox.min.x, i & 2 ? droneBox.max.y : droneBox.min.y, i & 4 ? droneBox.max.z : droneBox.min.z));
  const corner = new THREE.Vector3();
  scene.add(drone.root);
  const capture = buildCaptureFrame();
  scene.add(capture.group);

  const fog = new THREE.FogExp2(new THREE.Color(SKY.horizon).multiplyScalar(0.92), 0.00021);
  const DEFECT_POINT = defectPoint();
  const lensWorld = new THREE.Vector3();
  const qYaw = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  const SITE_CENTRE = new THREE.Vector3(-20, 62, 0);

  /** Image-based lighting from the same sky, plus a soft card where the key light sits. */
  function environment(renderer: THREE.WebGLRenderer) {
    const envScene = new THREE.Scene();
    const s = new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), skyMaterial());
    envScene.add(s);
    const card = new THREE.Mesh(new THREE.PlaneGeometry(40, 18), new THREE.MeshBasicMaterial({ color: new THREE.Color('#dfe8f5').multiplyScalar(2.2), side: THREE.DoubleSide }));
    card.position.copy(SUN).multiplyScalar(90);
    card.lookAt(0, 0, 0);
    envScene.add(card);
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(envScene, 0, 0.1, 400);
    pm.dispose();
    return rt.texture;
  }

  /** payload: render what the drone's own camera sees (the report image) instead of the story camera. */
  type Frame = { p: number; layout: Layout; time: number; motion: boolean; camera: THREE.PerspectiveCamera; width: number; height: number; payload?: boolean };

  function update({ p, layout, time, motion, camera, width, height, payload = false }: Frame) {
    // drone, with a levelled (stabilised) gimbal
    const st = droneState(p);
    drone.root.position.copy(st.position);
    drone.root.quaternion.copy(st.quaternion);
    const target = gimbalTarget(p, st.position, st.yaw);
    const ang = gimbalAngles(st.position, target, st.yaw);
    qYaw.setFromAxisAngle(Y, st.yaw + ang.yaw);
    drone.gimbalYaw.quaternion.copy(st.quaternion).invert().multiply(qYaw);
    drone.gimbalPitch.rotation.x = ang.pitch;
    for (const [i, pr] of drone.props.entries()) {
      pr.disc.visible = motion;
      if (motion) pr.node.rotation.y = i * 1.3 + pr.dir * time * Math.PI * 2 * 9;
    }
    const pm = mats.drone.prop as THREE.MeshPhysicalMaterial;
    if (pm.transparent !== motion) { pm.transparent = motion; pm.depthWrite = !motion; pm.opacity = motion ? 0.42 : 1; pm.needsUpdate = true; }

    // camera: no roll, near plane close only when the drone is close
    const pose = cameraPose(p, layout);
    camera.position.copy(pose.position);
    camera.up.set(0, 1, 0);
    camera.lookAt(pose.target);
    camera.fov = fitFov(pose.fov, layout, width / height);
    camera.near = Math.min(1.5, Math.max(0.03, camera.position.distanceTo(st.position) * 0.04));
    camera.far = 11000;
    camera.updateProjectionMatrix();
    sky.position.copy(camera.position);

    // capture zone
    drone.root.updateMatrixWorld(true);
    drone.lens.getWorldPosition(lensWorld);
    const levels = annotationLevels(p);
    capture.set(lensWorld, captureFrame(lensWorld, target), payload ? 0 : levels.capture);
    if (payload) {
      // the payload camera: from just in front of the zoom lens, about 13° of vertical view
      camera.position.copy(lensWorld).addScaledVector(target.clone().sub(lensWorld).normalize(), 0.05);
      camera.lookAt(target);
      camera.fov = 13;
      camera.near = 0.05;
      camera.updateProjectionMatrix();
      sky.position.copy(camera.position);
    }
    // the renderer would update this only when drawing; the projections below need it now
    camera.updateMatrixWorld();

    // shadows follow what the camera is looking at
    const w2 = smoothstep(remap(p, 0.18, 0.4)), w3 = smoothstep(remap(p, 0.46, 0.54)), w4 = smoothstep(remap(p, 0.8, 0.95));
    const extent = lerp(lerp(lerp(0.95, 95, w2), 24, w3), 130, w4);
    const focus = st.position.clone().lerp(SITE_CENTRE, w2).lerp(st.position, w3).lerp(SITE_CENTRE, w4);
    key.target.position.copy(focus);
    key.position.copy(focus).addScaledVector(SUN, extent * 3 + 60);
    const sc = key.shadow.camera;
    sc.left = sc.bottom = -extent; sc.right = sc.top = extent;
    sc.near = 1; sc.far = extent * 6 + 140;
    sc.updateProjectionMatrix();

    // ambient life: distant rotors turn, obstruction lights flash together
    for (const s of farm.spins) s.node.rotation.z = motion ? -(s.phase + (time * s.rpm * Math.PI * 2) / 60) : -s.phase;
    const on = motion ? (time % 1.5 < 0.75 ? 1 : 0.15) : 1;
    (mats.turbine.lamp as THREE.MeshStandardMaterial).emissiveIntensity = 2.2 * on;

    // screen positions for the HTML annotations
    const toScreen = (v: THREE.Vector3): ScreenPoint => {
      const ndc = v.clone().project(camera);
      return { x: (ndc.x * 0.5 + 0.5) * width, y: (-ndc.y * 0.5 + 0.5) * height, visible: ndc.z < 1 && Math.abs(ndc.x) < 1.05 && Math.abs(ndc.y) < 1.05 };
    };
    const droneRect = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
    for (const c of droneCorners) {
      const v = corner.copy(c).applyMatrix4(drone.root.matrixWorld).project(camera);
      const x = (v.x * 0.5 + 0.5) * width, y = (-v.y * 0.5 + 0.5) * height;
      droneRect.l = Math.min(droneRect.l, x); droneRect.r = Math.max(droneRect.r, x);
      droneRect.t = Math.min(droneRect.t, y); droneRect.b = Math.max(droneRect.b, y);
    }
    const next: Annotations = { drone: toScreen(st.position), droneRect, hub: toScreen(HUB), defect: toScreen(DEFECT_POINT), opacity: levels };
    annotations.set(next);
  }

  return { scene, fog, key, environment, update, drone, turbine: turbine.group };
}
