// A generic industrial quadcopter at real scale (metres), unbranded: 0.9 m diagonal
// wheelbase, 21-inch two-blade propellers, carbon arms with folding hinges, ventilated
// outrunner motors, skid landing gear, twin batteries, RTK antennas, stereo vision
// sensors and a three-axis gimbal carrying a zoom and a wide camera. Pure three.js.
//
// Frame: origin at the centre of mass, +z forward (nose), +y up, +x to the left.
import * as THREE from 'three';
import { cylinderY, lathe, loftSquircle, merge, tube, v3 } from './geometry';
import { deg, table } from '../math';

export const DRONE = {
  armRadius: 0.45, // motor axis distance from the centre (0.9 m diagonal)
  propRadius: 0.266, // 21-inch propellers
  propY: 0.079, // propeller plane above the centre of mass
  /** Radius of a sphere around the centre that encloses the whole aircraft, propeller discs included. */
  envelope: 0.76,
};

export type DroneMaterialName =
  | 'body' | 'shell' | 'light' | 'carbon' | 'alu' | 'aluDark' | 'prop' | 'rubber'
  | 'glass' | 'iris' | 'accent' | 'ledRed' | 'ledGreen' | 'ledWhite' | 'propDisc';
export type DroneMaterials = Record<DroneMaterialName, THREE.Material>;

export type DroneRig = {
  root: THREE.Group;
  gimbalYaw: THREE.Object3D;
  gimbalPitch: THREE.Object3D;
  /** At the front of the main lens, looking along its +z. */
  lens: THREE.Object3D;
  props: { node: THREE.Object3D; dir: 1 | -1; disc: THREE.Mesh; blades: THREE.Mesh }[];
};

// ------------------------------------------------------------------ propeller
const propChord = table([[0.024, 0.022], [0.04, 0.032], [0.07, 0.042], [0.11, 0.0435], [0.17, 0.037], [0.22, 0.029], [0.25, 0.022], [0.262, 0.014], [0.266, 0.004]]);
const propThick = table([[0.024, 0.3], [0.05, 0.16], [0.1, 0.11], [0.266, 0.075]]);
const PROP_PITCH = 0.17; // geometric pitch, metres per revolution

/** One two-blade propeller in its own frame (spins about +y). dir 1 = counter-clockwise seen from above. */
export function buildPropBlades(dir: 1 | -1, { stations = 26, ring = 18 } = {}) {
  const R = DRONE.propRadius;
  const rs: number[] = [];
  for (let i = 0; i <= stations; i++) { const u = i / stations; rs.push(0.024 + (R - 0.024) * (1 - (1 - u) ** 1.35)); }
  const half = ring >> 1, loop = half * 2;
  const blade = (sign: 1 | -1) => {
    const pos: number[] = [];
    for (const r of rs) {
      const c = propChord(r), t = propThick(r), th = Math.min(deg(38), Math.atan(PROP_PITCH / (2 * Math.PI * r)));
      for (let i = 0; i < loop; i++) {
        const q = i / loop, upper = q < 0.5;
        const beta = upper ? Math.PI * (1 - q * 2) : Math.PI * (q * 2 - 1);
        const x = (1 - Math.cos(beta)) / 2;
        const m = 0.045, p = 0.35;
        const yc = x < p ? (m / p ** 2) * (2 * p * x - x * x) : (m / (1 - p) ** 2) * (1 - 2 * p + 2 * p * x - x * x);
        const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1015 * x ** 4);
        const yy = (upper ? yc + yt : yc - yt) * c, zz = (x - 0.35) * c; // leading edge towards −z
        const y2 = yy * Math.cos(th) - zz * Math.sin(th), z2 = yy * Math.sin(th) + zz * Math.cos(th);
        pos.push(sign * r, y2, sign * z2 * dir);
      }
    }
    const idx: number[] = [];
    for (let s = 0; s < rs.length - 1; s++) for (let i = 0; i < loop; i++) {
      const a = s * loop + i, b = s * loop + ((i + 1) % loop), c = a + loop, d = b + loop;
      // the second blade is a rotation of the first; a clockwise propeller is a mirror
      if (dir > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  const hub = cylinderY(0.024, 0.016, -0.006, 24);
  return merge([blade(1), blade(-1), hub]);
}

// ------------------------------------------------------------------ assembly
export function buildDrone(mats: DroneMaterials, { ring = 40 } = {}): DroneRig {
  const root = new THREE.Group();
  root.name = 'drone';
  const parts = new Map<DroneMaterialName, THREE.BufferGeometry[]>();
  const add = (mat: DroneMaterialName, g: THREE.BufferGeometry) => { if (!parts.has(mat)) parts.set(mat, []); parts.get(mat)!.push(g); };
  const box = (mat: DroneMaterialName, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) => {
    const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); add(mat, g);
  };

  // fuselage, cover shell and a fine accent line between them
  add('body', loftSquircle([
    { z: 0.215, w: 0.13, h: 0.055, y: -0.004, n: 4 },
    { z: 0.2, w: 0.22, h: 0.085, y: 0, n: 4.5 },
    { z: 0.15, w: 0.29, h: 0.105, y: 0, n: 5 },
    { z: 0.02, w: 0.31, h: 0.11, y: 0, n: 6 },
    { z: -0.12, w: 0.3, h: 0.105, y: 0.004, n: 6 },
    { z: -0.19, w: 0.24, h: 0.09, y: 0.006, n: 5 },
    { z: -0.215, w: 0.14, h: 0.06, y: 0.008, n: 4 },
  ], ring));
  add('shell', loftSquircle([
    { z: 0.185, w: 0.17, h: 0.03, y: 0.05, n: 3 },
    { z: 0.14, w: 0.255, h: 0.052, y: 0.055, n: 4 },
    { z: 0.0, w: 0.272, h: 0.062, y: 0.058, n: 4.5 },
    { z: -0.13, w: 0.258, h: 0.056, y: 0.056, n: 4.5 },
    { z: -0.185, w: 0.17, h: 0.034, y: 0.05, n: 3 },
  ], ring));
  for (const x of [0.1375, -0.1375]) box('accent', 0.003, 0.005, 0.22, x, 0.044, -0.005);

  // front sensor face and stereo vision pairs (front, rear, sides, below)
  add('glass', loftSquircle([{ z: 0.2165, w: 0.16, h: 0.046, y: -0.003, n: 4 }, { z: 0.21, w: 0.17, h: 0.05, y: -0.003, n: 4 }], 32));
  const lensPair = (pts: [number, number, number][], axis: 'x' | 'y' | 'z') => {
    for (const [x, y, z] of pts) {
      const ring = new THREE.CylinderGeometry(0.0105, 0.0105, 0.006, 20), glass = new THREE.CylinderGeometry(0.0075, 0.0075, 0.008, 20);
      for (const g of [ring, glass]) {
        if (axis === 'z') g.rotateX(Math.PI / 2); else if (axis === 'x') g.rotateZ(Math.PI / 2);
        g.translate(x, y, z);
      }
      add('aluDark', ring); add('glass', glass);
    }
  };
  lensPair([[0.048, -0.003, 0.218], [-0.048, -0.003, 0.218]], 'z');
  lensPair([[0.045, 0.004, -0.216], [-0.045, 0.004, -0.216]], 'z');
  lensPair([[0.156, 0.002, 0.07], [0.156, 0.002, -0.03]], 'x');
  lensPair([[-0.156, 0.002, 0.07], [-0.156, 0.002, -0.03]], 'x');
  lensPair([[0.04, -0.056, -0.06], [-0.04, -0.056, -0.06]], 'y');

  // side cooling vents
  for (const x of [0.156, -0.156]) for (let i = 0; i < 7; i++) box('rubber', 0.004, 0.03, 0.006, x, 0.0, -0.11 + i * 0.012);

  // twin batteries with latch strips and charge indicators, RTK antennas
  for (const x of [0.042, -0.042]) {
    add('light', loftSquircle([
      { z: -0.02, w: 0.072, h: 0.058, x, y: 0.112, n: 6 },
      { z: -0.03, w: 0.076, h: 0.062, x, y: 0.112, n: 7 },
      { z: -0.16, w: 0.076, h: 0.062, x, y: 0.112, n: 7 },
      { z: -0.17, w: 0.072, h: 0.058, x, y: 0.112, n: 6 },
    ], 28));
    box('body', 0.05, 0.006, 0.11, x, 0.144, -0.095);
    for (let i = 0; i < 4; i++) box('ledWhite', 0.004, 0.004, 0.002, x - 0.012 + i * 0.008, 0.124, -0.1715);
  }
  for (const x of [0.105, -0.105]) {
    add('aluDark', tube(v3(x, 0.07, -0.165), v3(x, 0.14, -0.175), 0.0055, 10));
    add('light', cylinderY(0.033, 0.012, 0.14, 28).translate(x, 0, -0.175));
    add('body', cylinderY(0.026, 0.004, 0.152, 28).translate(x, 0, -0.175));
  }

  // arms, folding hinges, motors, LEDs and propellers
  const props: DroneRig['props'] = [];
  const corners: { a: number; dir: 1 | -1; led: DroneMaterialName }[] = [
    { a: 45, dir: 1, led: 'ledRed' }, // front-left (port)
    { a: -45, dir: -1, led: 'ledGreen' }, // front-right (starboard)
    { a: 135, dir: -1, led: 'ledWhite' },
    { a: -135, dir: 1, led: 'ledWhite' },
  ];
  for (const { a, dir, led } of corners) {
    const d = v3(Math.sin(deg(a)), 0, Math.cos(deg(a)));
    const at = (r: number, y: number) => d.clone().multiplyScalar(r).setY(y);
    const yaw = Math.atan2(d.x, d.z);
    add('carbon', tube(at(0.16, 0.012), at(0.43, 0.034), 0.017, 20));
    // hinge block, locking sleeve with a thin accent ring, motor clamp
    const hinge = new THREE.BoxGeometry(0.044, 0.04, 0.056); hinge.rotateY(yaw); hinge.translate(...at(0.19, 0.016).toArray()); add('alu', hinge);
    add('aluDark', tube(at(0.214, 0.0175), at(0.258, 0.0215), 0.0206, 20));
    add('accent', tube(at(0.259, 0.0216), at(0.263, 0.022), 0.0208, 20));
    const clamp = new THREE.BoxGeometry(0.046, 0.03, 0.05); clamp.rotateY(yaw); clamp.translate(...at(0.425, 0.034).toArray()); add('aluDark', clamp);
    // motor: stator base, bell with cooling slots, top cap
    const m = at(DRONE.armRadius, 0);
    add('aluDark', cylinderY(0.041, 0.018, 0.028, 36).translate(m.x, 0, m.z));
    add('aluDark', lathe([[0.046, 0.046], [0.047, 0.052], [0.047, 0.066], [0.043, 0.07], [0.03, 0.072], [0.012, 0.073]], 40).translate(m.x, 0, m.z));
    for (let k = 0; k < 12; k++) {
      const t = (k / 12) * Math.PI * 2;
      const slot = new THREE.BoxGeometry(0.004, 0.012, 0.012); slot.rotateY(t); slot.translate(m.x + Math.sin(t) * 0.0465, 0.059, m.z + Math.cos(t) * 0.0465); add('rubber', slot);
    }
    add('alu', cylinderY(0.016, 0.006, 0.072, 24).translate(m.x, 0, m.z));
    add(led, new THREE.SphereGeometry(0.0065, 12, 8).translate(...at(0.43, 0.012).toArray()));
    // propeller: blades + quick-release cap; a faint disc shows the spin
    const node = new THREE.Group();
    node.position.set(m.x, DRONE.propY, m.z);
    node.rotation.y = a * 0.7; // parked at different angles
    const blades = new THREE.Mesh(buildPropBlades(dir), mats.prop);
    blades.castShadow = true;
    const cap = new THREE.Mesh(cylinderY(0.013, 0.012, 0.006, 20), mats.alu);
    const discGeo = new THREE.RingGeometry(0.03, DRONE.propRadius, 64, 1); discGeo.rotateX(-Math.PI / 2);
    const disc = new THREE.Mesh(discGeo, mats.propDisc);
    disc.renderOrder = 2;
    disc.visible = false;
    node.add(blades, cap, disc);
    root.add(node);
    props.push({ node, dir, disc, blades });
  }

  // landing gear: two skids with splayed struts and rubber feet
  for (const s of [1, -1]) {
    for (const z of [0.105, -0.105]) {
      add('carbon', tube(v3(s * 0.085, -0.045, z), v3(s * 0.175, -0.305, z * 1.25), 0.011, 14));
      box('alu', 0.03, 0.022, 0.03, s * 0.085, -0.048, z);
    }
    add('carbon', tube(v3(s * 0.178, -0.318, -0.205), v3(s * 0.178, -0.318, 0.205), 0.012, 16));
    for (const z of [-0.205, 0.205]) add('rubber', new THREE.SphereGeometry(0.0135, 14, 10).translate(s * 0.178, -0.318, z));
    for (const z of [-0.13, 0.13]) add('rubber', tube(v3(s * 0.178, -0.333, z - 0.03), v3(s * 0.178, -0.333, z + 0.03), 0.009, 12));
  }

  // gimbal: quick-release mount with dampers, then yaw → (roll) → pitch, camera with two lenses
  add('aluDark', cylinderY(0.036, 0.008, -0.062, 32).translate(0, 0, 0.13));
  add('alu', cylinderY(0.032, 0.012, -0.074, 32).translate(0, 0, 0.13));
  for (const [x, z] of [[0.03, 0.105], [-0.03, 0.105], [0.03, 0.155], [-0.03, 0.155]]) add('rubber', new THREE.SphereGeometry(0.0075, 10, 8).translate(x, -0.058, z));
  const gimbalYaw = new THREE.Group();
  gimbalYaw.position.set(0, -0.078, 0.13);
  root.add(gimbalYaw);
  const gParts = new Map<DroneMaterialName, THREE.BufferGeometry[]>();
  const gAdd = (mat: DroneMaterialName, g: THREE.BufferGeometry) => { if (!gParts.has(mat)) gParts.set(mat, []); gParts.get(mat)!.push(g); };
  // the arm runs behind the camera, far enough for the camera body to tilt freely
  gAdd('aluDark', cylinderY(0.026, 0.03, -0.03, 32));
  gAdd('body', new THREE.BoxGeometry(0.02, 0.016, 0.1).translate(0, -0.036, -0.048));
  gAdd('body', new THREE.BoxGeometry(0.02, 0.05, 0.02).translate(0, -0.062, -0.095));
  const roll = new THREE.CylinderGeometry(0.022, 0.022, 0.026, 28); roll.rotateX(Math.PI / 2); roll.translate(0, -0.09, -0.095); gAdd('aluDark', roll);
  gAdd('body', new THREE.BoxGeometry(0.156, 0.014, 0.016).translate(0, -0.09, -0.077));
  for (const x of [0.072, -0.072]) gAdd('body', new THREE.BoxGeometry(0.012, 0.03, 0.084).translate(x, -0.098, -0.042));
  const pitchMotor = new THREE.CylinderGeometry(0.021, 0.021, 0.022, 28); pitchMotor.rotateZ(Math.PI / 2); pitchMotor.translate(0.072, -0.105, 0); gAdd('aluDark', pitchMotor);
  const gimbalPitch = new THREE.Group();
  gimbalPitch.position.set(0, -0.105, 0);
  gimbalYaw.add(gimbalPitch);
  const cParts = new Map<DroneMaterialName, THREE.BufferGeometry[]>();
  const cAdd = (mat: DroneMaterialName, g: THREE.BufferGeometry) => { if (!cParts.has(mat)) cParts.set(mat, []); cParts.get(mat)!.push(g); };
  cAdd('body', loftSquircle([
    { z: 0.042, w: 0.1, h: 0.074, x: -0.006, n: 5 },
    { z: 0.034, w: 0.112, h: 0.082, x: -0.006, n: 7 },
    { z: -0.034, w: 0.112, h: 0.082, x: -0.006, n: 7 },
    { z: -0.042, w: 0.1, h: 0.074, x: -0.006, n: 5 },
  ], 32));
  const barrel = lathe([[0.031, 0], [0.032, 0.006], [0.031, 0.026], [0.029, 0.034]], 40); barrel.rotateX(Math.PI / 2); barrel.translate(-0.016, 0.004, 0.04); cAdd('aluDark', barrel);
  const front = new THREE.CylinderGeometry(0.0265, 0.0265, 0.004, 40); front.rotateX(Math.PI / 2); front.translate(-0.016, 0.004, 0.0735); cAdd('glass', front);
  const iris = new THREE.RingGeometry(0.012, 0.025, 40); iris.translate(-0.016, 0.004, 0.0738); cAdd('iris', iris);
  const wide = new THREE.CylinderGeometry(0.0115, 0.0125, 0.012, 28); wide.rotateX(Math.PI / 2); wide.translate(0.03, -0.018, 0.047); cAdd('aluDark', wide);
  const wideGlass = new THREE.CylinderGeometry(0.009, 0.009, 0.003, 28); wideGlass.rotateX(Math.PI / 2); wideGlass.translate(0.03, -0.018, 0.0535); cAdd('glass', wideGlass);
  const lens = new THREE.Object3D();
  lens.position.set(-0.016, 0.004, 0.08);
  gimbalPitch.add(lens);

  const flush = (map: Map<DroneMaterialName, THREE.BufferGeometry[]>, parent: THREE.Object3D) => {
    for (const [mat, list] of map) {
      const mesh = new THREE.Mesh(merge(list), mats[mat]);
      mesh.name = mat;
      const emissive = mat.startsWith('led');
      mesh.castShadow = !emissive && mat !== 'glass';
      mesh.receiveShadow = !emissive;
      parent.add(mesh);
    }
  };
  flush(parts, root);
  flush(gParts, gimbalYaw);
  flush(cParts, gimbalPitch);
  return { root, gimbalYaw, gimbalPitch, lens, props };
}

/**
 * Points that cover the whole aircraft in its own frame: every vertex of the airframe and
 * gimbal plus each propeller's full swept disc, for clearance checks.
 */
export function droneEnvelopePoints(rig: DroneRig, discSamples = 48) {
  const pts: THREE.Vector3[] = [];
  rig.root.updateMatrixWorld(true);
  const inv = rig.root.matrixWorld.clone().invert();
  rig.root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.parent?.parent === rig.root && rig.props.some((p) => p.node === o.parent)) return;
    const P = o.geometry.getAttribute('position');
    const m = inv.clone().multiply(o.matrixWorld);
    for (let i = 0; i < P.count; i += 3) pts.push(new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i)).applyMatrix4(m));
  });
  for (const p of rig.props) for (let k = 0; k < discSamples; k++) {
    const t = (k / discSamples) * Math.PI * 2;
    for (const dy of [-0.012, 0.012]) pts.push(new THREE.Vector3(p.node.position.x + Math.cos(t) * DRONE.propRadius, p.node.position.y + dy, p.node.position.z + Math.sin(t) * DRONE.propRadius));
  }
  return pts;
}
