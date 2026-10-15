// Composition search: given where the drone and some leading-edge points should sit on screen,
// try many camera positions and fields of view (the camera always turned so the drone lands on
// its spot) and keep the closest fits. Pure geometry, no rendering.
//   solve.html?targets=drone:0.64:0.34,le36:0.95:0.88,le44:0.62:0.64&box=-60,-20,96,108,9,40&fov=24,60&aspect=1.6&n=40000
import * as THREE from 'three';
import { rng } from '../src/experience/math';
import { bladeSurfaceWorld } from '../src/experience/models/turbine';
import { HUB } from '../src/experience/trajectory';
import { aimAt } from './aim';
import { parseHover } from './hover';
import { buildProposalScene } from './scene';

declare global { interface Window { __solve?: unknown } }

const q = new URLSearchParams(location.search);
const { poseDrone } = buildProposalScene();
const drone = poseDrone(0.63, parseHover(q.get('hover'))).position;
const point = (name: string) => {
  if (name === 'drone') return drone;
  if (name === 'hub') return HUB.clone();
  const m = /^le(\d+(?:\.\d+)?)$/.exec(name);
  if (m) return bladeSurfaceWorld('B', Number(m[1]), 0.5);
  throw new Error(`unknown point ${name}`);
};
const targets = (q.get('targets') ?? '').split(',').map((t) => { const [n, x, y] = t.split(':'); return { p: point(n), x: Number(x), y: Number(y), name: n }; });
const [x0, x1, y0, y1, z0, z1] = (q.get('box') ?? '-60,-20,96,108,9,40').split(',').map(Number);
const [f0, f1] = (q.get('fov') ?? '24,60').split(',').map(Number);
const aspect = Number(q.get('aspect') ?? 1.6), N = Number(q.get('n') ?? 40000);
// stay clear of the blade surface and of the drone
const avoid = [30, 36, 40, 44, 48, 52, 56].flatMap((r) => [0.2, 0.5, 0.8].map((qq) => bladeSurfaceWorld('B', r, qq)));

const cam = new THREE.PerspectiveCamera(40, aspect, 0.05, 20000);
const v = new THREE.Vector3();
const rnd = rng(Number(q.get('seed') ?? 7));
const results: { err: number; cam: number[]; fov: number }[] = [];
for (let i = 0; i < N; i++) {
  cam.position.set(x0 + (x1 - x0) * rnd(), y0 + (y1 - y0) * rnd(), z0 + (z1 - z0) * rnd());
  if (cam.position.distanceTo(drone) < 3 || avoid.some((a) => a.distanceTo(cam.position) < 2.5)) continue;
  cam.fov = f0 + (f1 - f0) * rnd();
  cam.updateProjectionMatrix();
  aimAt(cam, drone, targets[0].x, targets[0].y);
  let err = 0;
  for (const t of targets.slice(1)) {
    v.copy(t.p).project(cam);
    if (v.z > 1) { err += 100; continue; }
    err += ((v.x + 1) / 2 - t.x) ** 2 + ((1 - v.y) / 2 - t.y) ** 2;
  }
  results.push({ err, cam: cam.position.toArray().map((n) => +n.toFixed(2)), fov: +cam.fov.toFixed(1) });
}
results.sort((a, b) => a.err - b.err);
window.__solve = results.slice(0, 12);
document.body.textContent = JSON.stringify(window.__solve, null, 1);
