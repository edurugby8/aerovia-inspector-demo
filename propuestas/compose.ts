// Composition search for the revised cover A: blade A seen from its sunlit face, the drone
// hovering off its leading edge. Samples drone poses, camera positions and fields of view,
// scores each frame on what the cover needs and lists the best. Pure geometry, no rendering.
//   compose.html?aspect=1.6&text=0.04,0.48,0.44,0.92&droneAt=0.40,0.62,0.26,0.50&cov=0.40,0.62&n=60000
// Scored: how much of the frame blade A covers; the text area kept clear of blade and drone; no
// ground in frame (only sky behind); the drone's apparent size and how steeply it is seen from
// below; the leading edge in view near the drone; the camera on the face side, upwind enough to
// read the leading edge; safe distances from blades, drone and camera.
import * as THREE from 'three';
import { rng } from '../src/experience/math';
import { bladeSurfaceWorld, type BladeId } from '../src/experience/models/turbine';
import { aimAt } from './aim';

declare global { interface Window { __compose?: unknown } }

const q = new URLSearchParams(location.search);
const nums = (k: string, d: string) => (q.get(k) ?? d).split(',').map(Number);
const aspect = Number(q.get('aspect') ?? 1.6), N = Number(q.get('n') ?? 60000);
const [tx0, ty0, tx1, ty1] = nums('text', '0.04,0.48,0.44,0.92');
const [ax0, ax1, ay0, ay1] = nums('droneAt', '0.40,0.62,0.26,0.50');
const [cov0, cov1] = nums('cov', '0.40,0.62');
const [f0, f1] = nums('fov', '44,64');
const [bx0, bx1, by0, by1, bz0, bz1] = nums('box', '14,34,116,140,-2,16');
const [r0, r1, dy0, dy1, dz0, dz1, dx0, dx1] = nums('hover', '37,42,-1,2.5,3,6.5,-0.5,3.5');
const [sizeMin, sizeMax = 1] = nums('size', '0.085'), steepMax = Number(q.get('steep') ?? 38), groundMin = Number(q.get('ground') ?? 2.5);
// roll range (deg); overlap: 1 = drone seen against the blade, 0 = against the sky, -1 = either
const [rl0, rl1] = nums('roll', '0,0'), overlap = Number(q.get('overlap') ?? -1);
const LOOK = { r: 40.1, q: 0.47 }; // the example erosion on blade A's leading edge
const NFACE = new THREE.Vector3(0.891, -0.454, 0); // blade A's sunlit face

// blade outlines (leading edge out, trailing edge back) and surface samples for clearances
const outline = (id: BladeId) => {
  const le: THREE.Vector3[] = [], te: THREE.Vector3[] = [];
  for (let r = 3; r <= 61.5; r += 1.5) { le.push(bladeSurfaceWorld(id, r, 0.5)); te.push(bladeSurfaceWorld(id, r, 0)); }
  return [...le, ...te.reverse()];
};
const OUT = { A: outline('A'), B: outline('B'), C: outline('C') };
const surf = (id: BladeId) => { const s: THREE.Vector3[] = []; for (let r = 4; r <= 60; r += 2) for (const qq of [0, 0.25, 0.5, 0.75]) s.push(bladeSurfaceWorld(id, r, qq)); return s; };
const SURF_A = surf('A'), SURF_ALL = [...SURF_A, ...surf('B'), ...surf('C')];
const LE = Array.from({ length: 11 }, (_, i) => bladeSurfaceWorld('A', 36 + i, 0.5));
const lookPt = bladeSurfaceWorld('A', LOOK.r, LOOK.q);

type P3 = [number, number, number];
type P2 = [number, number];
function clip3(poly: P3[], f: (p: P3) => number) {
  const out: P3[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if (fa >= 0 !== fb >= 0) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
  }
  return out;
}
function clip2(poly: P2[], f: (p: P2) => number) {
  const out: P2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if (fa >= 0 !== fb >= 0) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
const area = (p: P2[]) => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; };
const inRect = (p: P2[], x0: number, y0: number, x1: number, y1: number) =>
  [(v: P2) => v[0] - x0, (v: P2) => x1 - v[0], (v: P2) => v[1] - y0, (v: P2) => y1 - v[1]].reduce((acc, f) => (acc.length ? clip2(acc, f) : acc), p);

const cam = new THREE.PerspectiveCamera(50, aspect, 0.05, 20000);
const v = new THREE.Vector3(), dir = new THREE.Vector3();
/** A blade's outline as seen by the camera, clipped to the frame, in 0…1 screen units. */
function onScreen(pts: THREE.Vector3[], tanV: number, tanH: number): P2[] {
  const view = cam.matrixWorldInverse;
  let poly: P3[] = pts.map((p) => { v.copy(p).applyMatrix4(view); return [v.x, v.y, v.z]; });
  for (const f of [(p: P3) => -p[2] - 0.05, (p: P3) => -p[2] * tanH - p[0], (p: P3) => -p[2] * tanH + p[0], (p: P3) => -p[2] * tanV - p[1], (p: P3) => -p[2] * tanV + p[1]]) {
    if (!poly.length) break;
    poly = clip3(poly, f);
  }
  return poly.map((p) => [(p[0] / (-p[2] * tanH) + 1) / 2, (1 - p[1] / (-p[2] * tanV)) / 2]);
}
const screenOf = (p: THREE.Vector3): P2 => { v.copy(p).project(cam); return v.z > 1 ? [9, 9] : [(v.x + 1) / 2, (1 - v.y) / 2]; };
const inside = (p: P2[], x: number, y: number) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
// a grid over the frame: ground counts only where it is not hidden behind the blade
const GRID: P2[] = Array.from({ length: 13 * 9 }, (_, i) => [(i % 13) / 12, Math.floor(i / 13) / 8] as P2);
/** Elevation (deg) of the ray through screen point (sx, sy). */
const elevation = (sx: number, sy: number) => { dir.set(2 * sx - 1, 1 - 2 * sy, 0.5).unproject(cam).sub(cam.position).normalize(); return THREE.MathUtils.radToDeg(Math.asin(dir.y)); };


// one frame = [span, up, upwind, along x] of the drone, camera x y z, fov, drone screen x y, roll
type Frame = number[];
const LO = [r0, dy0, dz0, dx0, bx0, by0, bz0, f0, ax0, ay0, rl0], HI = [r1, dy1, dz1, dx1, bx1, by1, bz1, f1, ax1, ay1, rl1];
const drone = new THREE.Vector3();
let dropped = 0; // frames whose aim did not converge
function score(x: Frame) {
  const [hr, hdy, hdz, hdx, cx, cy, cz, fov, sx, sy, roll] = x;
  drone.copy(bladeSurfaceWorld('A', hr, 0.5)).add(v.set(hdx, hdy, hdz));
  if (SURF_A.some((s) => s.distanceTo(drone) < 3.6)) return null;
  cam.position.set(cx, cy, cz);
  const dCam = cam.position.distanceTo(drone);
  if (dCam < 2.6 || SURF_ALL.some((s) => s.distanceTo(cam.position) < 2.2)) return null;
  cam.fov = fov;
  cam.updateProjectionMatrix();
  aimAt(cam, drone, sx, sy, THREE.MathUtils.degToRad(roll));
  { const [ox, oy] = screenOf(drone); if (Math.hypot(ox - sx, oy - sy) > 0.01) { dropped++; return null; } }
  cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  const tanV = Math.tan(THREE.MathUtils.degToRad(fov / 2)), tanH = tanV * aspect;

  const bladeA = onScreen(OUT.A, tanV, tanH), bladeB = onScreen(OUT.B, tanV, tanH), bladeC = onScreen(OUT.C, tanV, tanH);
  const cov = area(bladeA);
  const others = area(bladeB) + area(bladeC);
  const textHit = [bladeA, bladeB, bladeC].reduce((s, p) => s + area(inRect(p, tx0, ty0, tx1, ty1)), 0) / ((tx1 - tx0) * (ty1 - ty0));
  const size = 0.9 / dCam / (2 * tanH); // drone width as a fraction of the frame width
  const halfW = size * 0.6, halfH = size * 0.6 * aspect;
  const droneText = Math.max(0, Math.min(sx + halfW, tx1) - Math.max(sx - halfW, tx0)) * Math.max(0, Math.min(sy + halfH, ty1) - Math.max(sy - halfH, ty0)) / (4 * halfW * halfH);
  const steep = THREE.MathUtils.radToDeg(Math.asin((drone.y - cy) / dCam));
  const ground = Math.min(90, ...GRID.filter(([gx, gy]) => !inside(bladeA, gx, gy)).map(([gx, gy]) => elevation(gx, gy)));
  const faceSide = cam.position.clone().sub(LE[4]).dot(NFACE), upwind = cz - LE[4].z;
  const le = LE.map(screenOf);
  const leIn = le.filter(([lx, ly]) => lx > 0.04 && lx < 0.96 && ly > 0.06 && ly < 0.94).length / le.length;
  const leNear = Math.min(...le.map(([lx, ly]) => Math.hypot((lx - sx) * aspect, ly - sy))) / aspect;
  const look = screenOf(lookPt);
  const against = inside(bladeA, sx, sy);

  let err = 0;
  err += 6 * Math.max(0, cov0 - cov) ** 2 + 6 * Math.max(0, cov - cov1) ** 2;
  err += 0.5 * others;
  err += 8 * textHit + 6 * droneText;
  err += 0.004 * Math.max(0, groundMin - ground) ** 2;
  err += 40 * Math.max(0, sizeMin - size) ** 2 + 40 * Math.max(0, size - sizeMax) ** 2;
  err += 0.0015 * Math.max(0, steep - steepMax) ** 2 + 0.0015 * Math.max(0, -2 - steep) ** 2;
  err += 0.5 * Math.max(0, 1.2 - faceSide) ** 2 + 0.5 * Math.max(0, 0.8 - upwind) ** 2;
  err += 0.6 * (1 - leIn) ** 2;
  err += 4 * Math.max(0, 0.05 - leNear) ** 2 + 4 * Math.max(0, leNear - 0.24) ** 2;
  if (look[0] < 0.05 || look[0] > 0.95 || look[1] < 0.05 || look[1] > 0.95) err += 0.2;
  if (overlap === 1 && !against) err += 0.3;
  if (overlap === 0 && against) err += 0.3;
  return {
    err: +err.toFixed(4), x, cam: [cx, cy, cz].map((n) => +n.toFixed(2)), fov: +fov.toFixed(1), aim: [+sx.toFixed(3), +sy.toFixed(3)], roll: +roll.toFixed(1), against,
    hover: `A:${hr.toFixed(2)},${hdy.toFixed(2)},${hdz.toFixed(2)},auto,${LOOK.r},${LOOK.q},${hdx.toFixed(2)}`,
    cov: +cov.toFixed(3), size: +size.toFixed(3), steep: +steep.toFixed(1), ground: +ground.toFixed(1), textHit: +textHit.toFixed(3), leNear: +leNear.toFixed(3),
  };
}
type Scored = NonNullable<ReturnType<typeof score>>;

const rnd = rng(Number(q.get('seed') ?? 11));
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
// 1. random frames over the whole range
let pool: Scored[] = [];
for (let i = 0; i < N; i++) {
  const s = score(LO.map((lo, k) => lo + (HI[k] - lo) * rnd()));
  if (s) pool.push(s);
}
const tried = pool.length;
pool.sort((a, b) => a.err - b.err);
const distinct = (list: Scored[], n: number, gap: number) => {
  const out: Scored[] = [];
  for (const r of list) {
    if (out.some((p) => Math.hypot(...p.cam.map((c, k) => c - r.cam[k])) < gap)) continue;
    out.push(r);
    if (out.length >= n) break;
  }
  return out;
};
// 2. refine the best distinct frames by local search with shrinking steps
const steps = HI.map((hi, k) => (hi - LO[k]) * 0.08);
const refined = distinct(pool, Number(q.get('seeds') ?? 24), 1.5).map((start) => {
  let best = start;
  for (let it = 0, M = Number(q.get('iters') ?? 1500); it < M; it++) {
    const shrink = 1 - 0.9 * (it / M);
    const x = best.x.map((val, k) => Math.min(HI[k], Math.max(LO[k], val + gauss() * steps[k] * shrink)));
    const s = score(x);
    if (s && s.err < best.err) best = s;
  }
  return best;
});
refined.sort((a, b) => a.err - b.err);
pool = [];
const picked = distinct(refined, Number(q.get('top') ?? 10), 1.0).map(({ x: _x, ...rest }) => rest);
window.__compose = { tried, picked, aimErr: dropped };
document.body.textContent = JSON.stringify(window.__compose, null, 1);
