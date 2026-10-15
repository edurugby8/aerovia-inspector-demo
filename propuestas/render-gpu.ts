// WebGPU version of render.ts: the path tracer the library maintains now (wavefront, MIS).
// Same query parameters and the same window.__done / __overlay / __progress outputs.
import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { WebGPUPathTracer } from 'three-gpu-pathtracer/webgpu';
import { DEFECT, bladeSurfaceWorld } from '../src/experience/models/turbine';
import { HUB } from '../src/experience/trajectory';
import { aimAt } from './aim';
import { parseHover } from './hover';
import { buildProposalScene } from './scene';
import { SHOTS, type Format, type ShotName } from './shots';

declare global { interface Window { __done?: { ms: number; samples: number }; __overlay?: unknown; __anchors?: unknown; __progress?: unknown } }

const q = new URLSearchParams(location.search);
const name = (q.get('shot') ?? 'a') as ShotName, fmt = (q.get('fmt') ?? 'wide') as Format;
const W = Number(q.get('w') ?? 1600), H = Number(q.get('h') ?? 900), SPP = Number(q.get('spp') ?? 64);
const vec = (s: string | null) => (s ? new THREE.Vector3(...s.split(',').map(Number)) : null);
const TONE = { agx: THREE.AgXToneMapping, neutral: THREE.NeutralToneMapping, aces: THREE.ACESFilmicToneMapping } as const;

const renderer = new WebGPURenderer({ antialias: false, powerPreference: 'high-performance' });
await renderer.init();
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = TONE[(q.get('tm') ?? 'agx') as keyof typeof TONE];
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const { scene, poseDrone } = buildProposalScene();
const shot = SHOTS[name][fmt];
renderer.toneMappingExposure = Number(q.get('exp') ?? shot.exposure);
const pose = poseDrone(shot.p, parseHover(q.get('hover')));
const camera = new THREE.PerspectiveCamera(Number(q.get('fov') ?? shot.fov), W / H, 0.05, 20000);
const placed = shot.camera(pose);
// camOn=r,q,dx,dy,dz: a camera placed relative to a point on blade B's surface
const camOn = q.get('camOn')?.split(',').map(Number);
camera.position.copy(camOn ? bladeSurfaceWorld('B', camOn[0], camOn[1]).add(new THREE.Vector3(camOn[2], camOn[3], camOn[4])) : vec(q.get('cam')) ?? placed.position);
const aim = q.get('aim')?.split(',').map(Number);
if (aim) aimAt(camera, pose.position, aim[0], aim[1]); else camera.lookAt(vec(q.get('look')) ?? placed.look);
camera.updateProjectionMatrix();
camera.updateMatrixWorld();

const screen = (v: THREE.Vector3) => { const n = v.clone().project(camera); return [Number(((n.x + 1) / 2).toFixed(4)), Number(((1 - n.y) / 2).toFixed(4))]; };
const defect = bladeSurfaceWorld(DEFECT.blade, DEFECT.r, DEFECT.q);
window.__overlay = {
  drone: screen(pose.position),
  defect: screen(defect),
  capture: [[DEFECT.span[0], 0.42], [DEFECT.span[1], 0.42], [DEFECT.span[1], 0.54], [DEFECT.span[0], 0.54]].map(([r, qq]) => screen(bladeSurfaceWorld('B', r, qq))),
  hub: screen(HUB),
};

const tScene = performance.now();
const pt = new WebGPUPathTracer(renderer);
pt.minSamples = 0;
pt.renderDelay = 0;
pt.fadeDuration = 0;
pt.dynamicLowRes = false;
pt.maxSamples = SPP;
pt.filterGlossyFactor = 0.5;
// more paths per call: fewer dispatches for the same samples on large frames
pt.frameBudget = Number(q.get('budget') ?? 1000000);
pt.setScene(scene, camera);
const t0 = performance.now();
window.__progress = { stage: 'scene ready', sceneMs: Math.round(t0 - tScene), samples: 0 };
let checking = false, lastCheck = 0;
const step = async () => {
  pt.renderSample();
  // read the sample counts back from the GPU only every few seconds
  if (!checking && performance.now() - lastCheck > 3000) {
    checking = true;
    lastCheck = performance.now();
    const c = await pt.getSampleCountsAsync();
    checking = false;
    window.__progress = { stage: 'sampling', sceneMs: Math.round(t0 - tScene), samples: c.min, avg: c.avg, ms: Math.round(performance.now() - t0) };
    if (c.min >= SPP) {
      for (let i = 0; i < 3; i++) { pt.renderSample(); await new Promise((r) => requestAnimationFrame(r)); }
      window.__done = { ms: Math.round(performance.now() - t0), samples: c.min };
      return;
    }
  }
  requestAnimationFrame(step);
};
requestAnimationFrame(step);
