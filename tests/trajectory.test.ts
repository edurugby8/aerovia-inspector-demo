// The whole flight, sampled densely: clearances measured against the real turbine
// geometry with the drone's full envelope (propeller discs included), the camera never
// inside or behind geometry, the drone framed for each screen format, and a calm camera.
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { beforeAll, describe, expect, it } from 'vitest';
import { ACTS, CLEARANCE } from '../src/experience/config';
import { buildDrone, droneEnvelopePoints, DRONE, type DroneMaterials } from '../src/experience/models/drone';
import { merge } from '../src/experience/models/geometry';
import { terrainHeight } from '../src/experience/models/landscape';
import { turbineWorldGeometries } from '../src/experience/models/turbine';
import { cameraPose, droneState, fitFov, gimbalAngles, gimbalTarget, layoutFor, type Layout } from '../src/experience/trajectory';

const SAMPLES = 1500;
const ps = Array.from({ length: SAMPLES + 1 }, (_, i) => i / SAMPLES);
const ASPECT: Record<Layout, number> = { wide: 1440 / 900, tall: 390 / 844 };

let bvh: MeshBVH;
let envelope: THREE.Vector3[];
const hit = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 };
const surfaceDistance = (v: THREE.Vector3) => (bvh.closestPointToPoint(v, hit) ? hit.distance : Infinity);

beforeAll(() => {
  const g = turbineWorldGeometries({ ring: 48, spanScale: 1 });
  const all = merge([g.tower, g.nacelle, g.details, g.spinner, ...g.blades]);
  bvh = new MeshBVH(all);
  const mats = new Proxy({}, { get: () => new THREE.MeshBasicMaterial() }) as DroneMaterials;
  const rig = buildDrone(mats, { ring: 24 });
  envelope = droneEnvelopePoints(rig).filter((_, i) => i % 3 === 0);
});

/** Minimum distance from the drone's envelope to the turbine at progress p. */
function droneClearance(p: number) {
  const st = droneState(p);
  const centre = surfaceDistance(st.position);
  if (centre - DRONE.envelope > CLEARANCE + 3) return centre - DRONE.envelope; // far: the sphere bound is enough
  const m = new THREE.Matrix4().compose(st.position, st.quaternion, new THREE.Vector3(1, 1, 1));
  let min = Infinity;
  const v = new THREE.Vector3();
  for (const e of envelope) { min = Math.min(min, surfaceDistance(v.copy(e).applyMatrix4(m))); }
  return min;
}

describe('drone clearance', () => {
  it(`keeps its whole envelope ≥ ${CLEARANCE} m from every turbine surface along the whole path`, () => {
    let worst = { p: 0, d: Infinity };
    for (const p of ps) { const d = droneClearance(p); if (d < worst.d) worst = { p, d }; }
    console.info(`closest approach: ${worst.d.toFixed(2)} m at p = ${worst.p.toFixed(3)}`);
    expect(worst.d).toBeGreaterThanOrEqual(CLEARANCE);
  });

  it('flies above the terrain with room to spare', () => {
    for (const p of ps) { const s = droneState(p).position; expect(s.y - terrainHeight(s.x, s.z)).toBeGreaterThan(30); }
  });

  it('tilts like a multirotor would: never more than 15°, level when hovering', () => {
    for (const p of ps) expect(droneState(p).tilt).toBeLessThanOrEqual(THREE.MathUtils.degToRad(15) + 1e-6);
    expect(droneState(0.05).tilt).toBeLessThan(1e-3);
    expect(droneState(0.95).tilt).toBeLessThan(1e-3);
  });

  it('points the payload camera at the blade during the inspection pass', () => {
    for (const p of ps.filter((x) => x >= 0.52 && x <= 0.76)) {
      const st = droneState(p);
      const target = gimbalTarget(p, st.position, st.yaw);
      const a = gimbalAngles(st.position, target, st.yaw);
      expect(Math.abs(a.yaw)).toBeLessThan(THREE.MathUtils.degToRad(80));
      expect(a.pitch).toBeGreaterThan(0); // looking down at the leading edge
      expect(st.position.distanceTo(target)).toBeLessThan(12);
    }
  });
});

describe.each(['wide', 'tall'] as Layout[])('camera, %s layout', (layout) => {
  const cam = new THREE.PerspectiveCamera(40, ASPECT[layout], 0.05, 11000);
  const pose = (p: number) => {
    const c = cameraPose(p, layout);
    cam.fov = c.fov; cam.position.copy(c.position); cam.up.set(0, 1, 0); cam.lookAt(c.target);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    return c;
  };

  it('is chosen for this aspect ratio', () => expect(layoutFor(ASPECT[layout])).toBe(layout));

  it('never enters or grazes geometry: ≥ 2 m from the turbine, outside the drone, above the ground', () => {
    let worst = Infinity;
    for (const p of ps) {
      const c = pose(p);
      const d = surfaceDistance(c.position);
      worst = Math.min(worst, d);
      expect(d).toBeGreaterThan(2);
      expect(c.position.distanceTo(droneState(p).position)).toBeGreaterThan(DRONE.envelope + 0.5);
      expect(c.position.y - terrainHeight(c.position.x, c.position.z)).toBeGreaterThan(15);
    }
    console.info(`${layout}: camera closest to the turbine ${worst.toFixed(1)} m`);
  });

  it('keeps the drone in frame and unobstructed through acts 1–3', () => {
    const ray = new THREE.Ray();
    for (const p of ps.filter((x) => x <= ACTS[2].to)) {
      pose(p);
      const d = droneState(p).position;
      const ndc = d.clone().project(cam);
      expect(Math.abs(ndc.x), `x at p=${p}`).toBeLessThan(0.92);
      expect(Math.abs(ndc.y), `y at p=${p}`).toBeLessThan(0.92);
      ray.origin.copy(cam.position); ray.direction.copy(d).sub(cam.position).normalize();
      const blocked = bvh.raycastFirst(ray, THREE.DoubleSide);
      if (blocked) expect(blocked.distance, `occluded at p=${p}`).toBeGreaterThan(cam.position.distanceTo(d));
    }
  });

  it('keeps the drone clear of the text while the text is fully shown', () => {
    // where each act's copy sits (normalised device coordinates); see page.css
    const zones: Record<Layout, { from: number; to: number; inText: (x: number, y: number) => boolean }[]> = {
      wide: [
        { from: 0, to: 0.13, inText: (x) => x < -0.05 }, // left column
        { from: 0.27, to: 0.42, inText: (x, y) => x < -0.05 && y < 0.1 }, // bottom left
        { from: 0.55, to: 0.72, inText: (x, y) => x < -0.05 && y > -0.05 }, // top left
      ],
      tall: [
        { from: 0, to: 0.13, inText: (_x, y) => y < -0.05 }, // lower part
        { from: 0.27, to: 0.42, inText: (_x, y) => y < -0.05 },
        { from: 0.55, to: 0.72, inText: (_x, y) => y < -0.05 },
      ],
    };
    for (const z of zones[layout]) for (const p of ps.filter((x) => x >= z.from && x <= z.to)) {
      pose(p);
      const ndc = droneState(p).position.project(cam);
      expect(z.inText(ndc.x, ndc.y), `drone under the text at p=${p} (${ndc.x.toFixed(2)}, ${ndc.y.toFixed(2)})`).toBe(false);
    }
  });

  it('moves calmly: no roll, no jumps, never more than half a turn', () => {
    let prevYaw: number | null = null, min = Infinity, max = -Infinity, total = 0;
    for (const p of ps) {
      const c = pose(p);
      const dir = c.target.clone().sub(c.position);
      let yaw = Math.atan2(dir.x, dir.z);
      if (prevYaw !== null) {
        while (yaw - prevYaw > Math.PI) yaw -= 2 * Math.PI;
        while (yaw - prevYaw < -Math.PI) yaw += 2 * Math.PI;
        expect(Math.abs(yaw - prevYaw), `yaw step at p=${p}`).toBeLessThan(THREE.MathUtils.degToRad(1.2));
        total += Math.abs(yaw - prevYaw);
      }
      prevYaw = yaw; min = Math.min(min, yaw); max = Math.max(max, yaw);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
      expect(Math.abs(right.y)).toBeLessThan(1e-6); // horizon level
      expect(up.y).toBeGreaterThan(0);
    }
    console.info(`${layout}: yaw range ${THREE.MathUtils.radToDeg(max - min).toFixed(0)}°, total ${THREE.MathUtils.radToDeg(total).toFixed(0)}°`);
    expect(max - min).toBeLessThan(Math.PI);
  });

  it('is a pure function of progress: forwards and backwards give the same frames', () => {
    const fwd = ps.map((p) => cameraPose(p, layout).position.toArray());
    const back = [...ps].reverse().map((p) => cameraPose(p, layout).position.toArray()).reverse();
    expect(back).toEqual(fwd);
  });
});

describe('field of view on other screen shapes', () => {
  const hfov = (v: number, aspect: number) => 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(v) / 2) * aspect);
  it('keeps the framed width on narrower screens and leaves wider ones as framed', () => {
    expect(fitFov(40, 'wide', 16 / 9)).toBe(40);
    expect(fitFov(56, 'tall', 0.6)).toBe(56);
    expect(hfov(fitFov(40, 'wide', 4 / 3), 4 / 3)).toBeCloseTo(hfov(40, 1.6), 9);
    expect(hfov(fitFov(56, 'tall', 0.42), 0.42)).toBeCloseTo(hfov(56, 0.46), 9);
  });
});
