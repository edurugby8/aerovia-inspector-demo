// Everything that moves, as pure functions of the scroll progress p ∈ [0, 1]: the drone's
// path, heading and attitude, the gimbal, the camera for each screen format and the
// in-scene annotations. Nothing here reads a clock, so the scene always looks the same
// at the same p, forwards or backwards, and stops when the scroll stops.
import * as THREE from 'three';
import { NOMINAL_SCROLL_S, STANDOFF } from './config';
import { clamp, deg, remap, smootherstep, smoothstep, table } from './math';
import { bladeAxisWorld, bladeSurfaceWorld, DEFECT, TURBINE } from './models/turbine';

export type Layout = 'wide' | 'tall';
/** Portrait phones and tablets get their own framing. */
export const layoutFor = (aspect: number): Layout => (aspect < 0.9 ? 'tall' : 'wide');

/** The aspect ratios the camera keys were framed for (16:10 and a 390×844 phone). */
const DESIGN_ASPECT: Record<Layout, number> = { wide: 1.6, tall: 0.46 };
/** Narrower screens than the design open the vertical field of view so the same width stays in frame. */
export function fitFov(fov: number, layout: Layout, aspect: number) {
  const k = Math.max(1, DESIGN_ASPECT[layout] / aspect);
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * k));
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export const HUB = V(0, TURBINE.hubHeight, TURBINE.hubZ);
/** Where the drone hovers during the presentation, ~150 m in front and to the left of the rotor. */
export const P0 = V(-95, 82, 120);

const OFFSET = V(0, STANDOFF.up, STANDOFF.upwind);
/** The pass position next to blade B at span r (m from the hub centre). */
export function standoff(r: number, out = new THREE.Vector3()) {
  return bladeAxisWorld('B', r, out).add(OFFSET);
}

// ------------------------------------------------------------------ drone path
/** The pass runs from the tip towards the root, slowing down over the example defect. */
export const PASS = { from: 57, to: 24 };
const passShape = table([[0, 0], [0.3, 0.31], [0.45, 0.385], [0.6, 0.43], [0.75, 0.58], [1, 1]]);
export function passSpan(p: number) {
  const s = smoothstep(remap(p, 0.48, 0.78));
  return PASS.from - (PASS.from - PASS.to) * passShape(s);
}

let approachCurve: THREE.CatmullRomCurve3 | null = null;
function approach() {
  if (!approachCurve) {
    approachCurve = new THREE.CatmullRomCurve3([P0.clone(), V(-104, 90, 88), V(-86, 101, 44), standoff(PASS.from)], false, 'centripetal');
    approachCurve.arcLengthDivisions = 600;
  }
  return approachCurve;
}

export function dronePosition(p: number, out = new THREE.Vector3()) {
  const q = clamp(p);
  if (q <= 0.18) return out.copy(P0);
  if (q < 0.48) return approach().getPointAt(smootherstep(remap(q, 0.18, 0.48)), out);
  return standoff(passSpan(Math.min(q, 0.78)), out);
}

/** Nose azimuth (radians, from +z towards +x): 3/4 to the camera, then along the flight, then facing the blade. */
const yawDeg = table([[0, 62], [0.18, 62], [0.27, 146], [0.4, 166], [0.48, 180], [1, 180]]);
export const droneYaw = (p: number) => deg(yawDeg(clamp(p)));

const G = 9.81, DRAG = 0.014; // quadratic drag: ~8° of tilt to cruise at 10 m/s
const MAX_TILT = deg(15);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Matrix4();

/** Position, velocity, acceleration and an attitude a multirotor would need for them. */
export function droneState(p: number) {
  const position = dronePosition(p);
  const h = 0.002, s = 1 / NOMINAL_SCROLL_S;
  dronePosition(p - h, _a); dronePosition(p + h, _b);
  const velocity = _b.clone().sub(_a).multiplyScalar(s / (2 * h));
  const accel = _b.clone().add(_a).sub(position.clone().multiplyScalar(2)).multiplyScalar((s * s) / (h * h));
  const speedH = Math.hypot(velocity.x, velocity.z);
  const need = V(accel.x + DRAG * speedH * velocity.x, G + accel.y, accel.z + DRAG * speedH * velocity.z);
  const tilt = Math.atan2(Math.hypot(need.x, need.z), need.y);
  if (tilt > MAX_TILT) { const k = Math.tan(MAX_TILT) * need.y / Math.hypot(need.x, need.z); need.x *= k; need.z *= k; }
  const up = need.normalize();
  const yaw = droneYaw(p);
  const fwd = V(Math.sin(yaw), 0, Math.cos(yaw));
  fwd.sub(up.clone().multiplyScalar(fwd.dot(up))).normalize();
  const left = up.clone().cross(fwd);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(left, up, fwd));
  return { position, velocity, accel, yaw, quaternion, tilt: Math.min(tilt, MAX_TILT) };
}

// ------------------------------------------------------------------ gimbal
const DEFECT_POINT = bladeSurfaceWorld(DEFECT.blade, DEFECT.r, DEFECT.q);
export const defectPoint = () => DEFECT_POINT.clone();

/** What the payload camera looks at: ahead in flight, the blade's leading edge during the pass, the defect while hovering over it. */
export function gimbalTarget(p: number, position: THREE.Vector3, yaw: number, out = new THREE.Vector3()) {
  const ahead = V(Math.sin(yaw) * 20, -6, Math.cos(yaw) * 20).add(position);
  const onBlade = bladeSurfaceWorld('B', passSpan(clamp(p, 0.48, 0.78)), 0.47);
  out.copy(ahead).lerp(onBlade, smoothstep(remap(p, 0.4, 0.5)));
  const dwell = smoothstep(remap(p, 0.575, 0.605)) * (1 - smoothstep(remap(p, 0.665, 0.7)));
  return out.lerp(DEFECT_POINT, dwell);
}

/** Gimbal angles relative to the aircraft's heading; pitch positive = camera down, limits −30°…90°. */
export function gimbalAngles(position: THREE.Vector3, target: THREE.Vector3, yaw: number) {
  const d = target.clone().sub(position);
  let rel = Math.atan2(d.x, d.z) - yaw;
  rel = Math.atan2(Math.sin(rel), Math.cos(rel));
  const pitch = Math.max(deg(-30), Math.min(deg(90), Math.atan2(-d.y, Math.hypot(d.x, d.z))));
  return { yaw: rel, pitch };
}

/** The capture zone: the payload camera's frame where it meets the surface (simulated 21° × 14° zoom). */
export function captureFrame(lens: THREE.Vector3, target: THREE.Vector3) {
  const d = target.clone().sub(lens), dist = d.length();
  const fwd = d.normalize();
  const right = new THREE.Vector3(0, 1, 0).cross(fwd).normalize();
  const up = fwd.clone().cross(right).normalize();
  const w = dist * Math.tan(deg(10.5)), h = dist * Math.tan(deg(7));
  const c = target.clone().addScaledVector(fwd, -0.12); // a hair in front of the surface
  return [
    c.clone().addScaledVector(right, -w).addScaledVector(up, -h),
    c.clone().addScaledVector(right, w).addScaledVector(up, -h),
    c.clone().addScaledVector(right, w).addScaledVector(up, h),
    c.clone().addScaledVector(right, -w).addScaledVector(up, h),
  ];
}

/** Opacity of the in-scene annotations. */
export function annotations(p: number) {
  return {
    scale: smoothstep(remap(p, 0.29, 0.34)) * (1 - smoothstep(remap(p, 0.43, 0.48))),
    capture: smoothstep(remap(p, 0.5, 0.54)) * (1 - smoothstep(remap(p, 0.76, 0.8))),
    marker: smoothstep(remap(p, 0.585, 0.62)) * (1 - smoothstep(remap(p, 0.86, 0.9))),
  };
}

// ------------------------------------------------------------------ camera
type Vec = [number, number, number];
/**
 * A camera key. 'rel' values are offsets from the drone (the camera follows it); 'abs'
 * values are world positions. Each layout gets its own keys: a portrait screen is framed,
 * not cropped.
 */
type Key = { p: number; mode: 'abs' | 'rel'; pos: Vec; target: Vec; fov: number };

/** Wide screens: the drone to the right of the headline, then an elevated 3/4 follow. */
const WIDE: Key[] = [
  // presentation: 4 m from the drone, level with it so the sky sits behind; right of the headline
  { p: 0, mode: 'rel', pos: [1.72, 0.05, 3.6], target: [-0.675, 0.3, 0.32], fov: 32 },
  { p: 0.15, mode: 'rel', pos: [1.46, 0.08, 3.36], target: [-0.64, 0.3, 0.33], fov: 32 },
  // approach: the camera opens out and rises; drone and rotor both right of the copy
  { p: 0.3, mode: 'abs', pos: [-170, 118, 182], target: [-120.5, 104.1, 96.2], fov: 38 },
  { p: 0.45, mode: 'abs', pos: [-150, 165, 175], target: [-82, 126.2, 47.1], fov: 38 },
  // inspection: 3/4 follow from behind, a little above the drone and upwind of the rotor,
  // low enough that the air between drone and blade is visible
  { p: 0.53, mode: 'rel', pos: [-6.8, 1.6, 10.4], target: [5.28, 0.66, -5.5], fov: 40 },
  { p: 0.74, mode: 'rel', pos: [-6.6, 1.8, 10.6], target: [5.5, 0.6, -5.7], fov: 40 },
  // result: rise and open to the wind farm
  { p: 0.86, mode: 'abs', pos: [-54, 138, 98], target: [-12, 92, 0], fov: 42 },
  { p: 1, mode: 'abs', pos: [-66, 178, 236], target: [2, 78, -40], fov: 42 },
];
/** Portrait screens: the drone in the upper half above the text, followed closely through the approach. */
const TALL: Key[] = [
  { p: 0, mode: 'rel', pos: [2.28, 0.16, 4.77], target: [0, -0.62, 0], fov: 44 },
  { p: 0.15, mode: 'rel', pos: [2.07, 0.18, 4.45], target: [0, -0.6, 0], fov: 44 },
  { p: 0.3, mode: 'rel', pos: [-58, 36, 56], target: [14, -12, -14], fov: 56 },
  { p: 0.45, mode: 'rel', pos: [-62, 45, 70], target: [20, -16, -16], fov: 56 },
  { p: 0.53, mode: 'rel', pos: [-9, 2.5, 11], target: [3.07, -3.55, -3.76], fov: 56 },
  { p: 0.74, mode: 'rel', pos: [-8.8, 2.7, 11.2], target: [3.2, -3.6, -3.9], fov: 56 },
  { p: 0.86, mode: 'abs', pos: [-70, 150, 120], target: [-10, 88, 0], fov: 58 },
  { p: 1, mode: 'abs', pos: [-92, 205, 300], target: [0, 72, -30], fov: 58 },
];
export const CAMERA_KEYS: Record<Layout, Key[]> = { wide: WIDE, tall: TALL };

const vec = (v: Vec) => V(v[0], v[1], v[2]);

/**
 * Between two follow offsets: distance changes geometrically and the angles linearly, so
 * the camera backs away before it swings round instead of whipping past the drone.
 */
function orbit(a: Vec, b: Vec, t: number) {
  const A = vec(a), B = vec(b), ra = A.length(), rb = B.length();
  const az0 = Math.atan2(A.x, A.z);
  let daz = Math.atan2(B.x, B.z) - az0;
  daz = Math.atan2(Math.sin(daz), Math.cos(daz));
  const el0 = Math.asin(A.y / ra), el1 = Math.asin(B.y / rb);
  const r = ra * (rb / ra) ** t, az = az0 + daz * t, el = el0 + (el1 - el0) * t;
  return V(Math.sin(az) * Math.cos(el) * r, Math.sin(el) * r, Math.cos(az) * Math.cos(el) * r);
}
type Anchor = { p: number; pos: THREE.Vector3; target: THREE.Vector3; fov: number };
const anchorCache = new Map<Layout, Anchor[]>();
/** Each key's pose at its own p: the fixed control points of the camera path. */
function anchors(layout: Layout) {
  let a = anchorCache.get(layout);
  if (!a) {
    a = CAMERA_KEYS[layout].map((k) => {
      const base = k.mode === 'rel' ? dronePosition(k.p) : V(0, 0, 0);
      return { p: k.p, pos: base.clone().add(vec(k.pos)), target: base.clone().add(vec(k.target)), fov: k.fov };
    });
    anchorCache.set(layout, a);
  }
  return a;
}

/** Non-uniform cubic Hermite (Catmull-Rom tangents) through fixed points: C1 in p. */
function hermite<T>(pts: Anchor[], q: number, get: (a: Anchor) => T, ops: { add: (a: T, b: T) => T; sub: (a: T, b: T) => T; scale: (a: T, s: number) => T }) {
  let i = 0;
  while (i < pts.length - 2 && q > pts[i + 1].p) i++;
  const a0 = pts[Math.max(0, i - 1)], a1 = pts[i], a2 = pts[i + 1], a3 = pts[Math.min(pts.length - 1, i + 2)];
  const P0v = get(a0), P1 = get(a1), P2 = get(a2), P3 = get(a3);
  const dt = a2.p - a1.p, t = clamp((q - a1.p) / dt);
  const m1 = a0 === a1 ? ops.sub(P2, P1) : ops.scale(ops.sub(P2, P0v), dt / (a2.p - a0.p));
  const m2 = a3 === a2 ? ops.sub(P2, P1) : ops.scale(ops.sub(P3, P1), dt / (a3.p - a1.p));
  const t2 = t * t, t3 = t2 * t;
  return ops.add(ops.add(ops.scale(P1, 2 * t3 - 3 * t2 + 1), ops.scale(m1, t3 - 2 * t2 + t)), ops.add(ops.scale(P2, -2 * t3 + 3 * t2), ops.scale(m2, t3 - t2)));
}
const vecOps = {
  add: (a: THREE.Vector3, b: THREE.Vector3) => a.clone().add(b),
  sub: (a: THREE.Vector3, b: THREE.Vector3) => a.clone().sub(b),
  scale: (a: THREE.Vector3, s: number) => a.clone().multiplyScalar(s),
};
const numOps = { add: (a: number, b: number) => a + b, sub: (a: number, b: number) => a - b, scale: (a: number, s: number) => a * s };

/**
 * Camera position, look-at target and vertical field of view; the camera never rolls.
 * A fixed path through the keys is blended, with smooth weights, into an exact follow of
 * the drone wherever the keys are relative to it.
 */
export function cameraPose(p: number, layout: Layout) {
  const q = clamp(p);
  const keys = CAMERA_KEYS[layout], pts = anchors(layout);
  const position = hermite(pts, q, (a) => a.pos, vecOps);
  const target = hermite(pts, q, (a) => a.target, vecOps);
  const fov = hermite(pts, q, (a) => a.fov, numOps);
  let i = 0;
  while (i < keys.length - 2 && q > keys[i + 1].p) i++;
  const a = keys[i], b = keys[i + 1], t = clamp((q - a.p) / (b.p - a.p));
  let w = 0, offPos = vec(a.pos), offTarget = vec(a.target);
  // the aim point moves on later than the camera, keeping the drone in frame while it backs away
  if (a.mode === 'rel' && b.mode === 'rel') { w = 1; offPos = orbit(a.pos, b.pos, smoothstep(t)); offTarget.lerp(vec(b.target), smoothstep(t) ** 2); }
  else if (a.mode === 'rel') w = 1 - smootherstep(t);
  else if (b.mode === 'rel') { w = smootherstep(t); offPos = vec(b.pos); offTarget = vec(b.target); }
  if (w > 0) {
    const d = dronePosition(q);
    position.lerp(d.clone().add(offPos), w);
    target.lerp(d.clone().add(offTarget), w);
  }
  return { position, target, fov };
}
