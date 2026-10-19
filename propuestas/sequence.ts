// The motion test, frame by frame, with the WebGPU path tracer. scripts/render-secuencia.mjs
// drives it: window.__frame(i, n) poses the drone and the camera for frame i of n (motion.ts),
// traces it to `spp` samples and resolves; the script then saves the canvas. The scene is
// built once; between frames only transforms and the camera change.
//   sequence.html?w=1280&h=800&spp=192[&mode=raster][&start=mobile][&exp=1]
import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { WebGPUPathTracer } from 'three-gpu-pathtracer/webgpu';
import { rng } from '../src/experience/math';
import { aimAt } from './aim';
import { skyFromQuery } from './environment';
import { COVER, COVER_MOBILE, SUN, poseAt } from './motion';
import { studioPoseAt } from './motion-studio';
import { buildProposalScene } from './scene';
import { spinProps } from './surfaces';

declare global { interface Window { __frame?: (i: number, n: number) => Promise<{ ms: number; samples: number }>; __ready?: boolean } }

const q = new URLSearchParams(location.search);
const W = Number(q.get('w') ?? 1280), H = Number(q.get('h') ?? 800), SPP = Number(q.get('spp') ?? 192);
const raster = q.get('mode') === 'raster';
const start = q.get('start') === 'mobile' ? COVER_MOBILE : COVER;

const renderer = new WebGPURenderer({ antialias: raster, powerPreference: 'high-performance' });
await renderer.init();
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = Number(q.get('exp') ?? 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const { scene, drone, poseDrone } = buildProposalScene({ sunDir: SUN.clone(), sky: await skyFromQuery(q), studio: q.get('studio') === '1' });
const camera = new THREE.PerspectiveCamera(start.fov, W / H, 0.05, 20000);
// a new, unrelated propeller phase each frame, as a short shutter catches a spinning rotor;
// derived from the frame number so a resumed run renders the same frames
const seed = Number(q.get('seed') ?? 5);

// motion=studio: the inspection pass along blade B in the studio (motion-studio.ts)
const motion = q.get('motion') === 'studio' ? studioPoseAt : (t: number) => poseAt(t, start);

function place(t: number, i = 0) {
  const p = motion(t);
  poseDrone(0.63, { position: p.drone, yaw: Math.atan2(p.look.x - p.drone.x, p.look.z - p.drone.z), look: p.look });
  spinProps(drone, rng(seed * 7919 + i)() * Math.PI * 2);
  drone.root.updateMatrixWorld(true);
  camera.position.copy(p.camera);
  camera.fov = p.fov;
  camera.updateProjectionMatrix();
  aimAt(camera, p.drone, p.aim[0], p.aim[1], p.roll);
}

const frame = () => new Promise((r) => requestAnimationFrame(r));
place(0);
let pt: WebGPUPathTracer | null = null;
if (!raster) {
  pt = new WebGPUPathTracer(renderer);
  pt.minSamples = 0;
  pt.renderDelay = 0;
  pt.fadeDuration = 0;
  pt.dynamicLowRes = false;
  pt.maxSamples = SPP;
  pt.filterGlossyFactor = 0.5;
  pt.frameBudget = Number(q.get('budget') ?? 1000000);
  pt.setScene(scene, camera);
}
window.__ready = true;

window.__frame = async (i, n) => {
  const t0 = performance.now();
  place(n > 1 ? i / (n - 1) : 0, i);
  if (!pt) {
    renderer.render(scene, camera);
    await frame();
    return { ms: Math.round(performance.now() - t0), samples: 0 };
  }
  pt.updateTransforms();
  pt.updateCamera();
  let samples = 0, last = performance.now();
  for (;;) {
    pt.renderSample();
    await frame();
    if (performance.now() - last > 1500) {
      last = performance.now();
      samples = (await pt.getSampleCountsAsync()).min;
      if (samples >= SPP) break;
    }
  }
  for (let k = 0; k < 2; k++) { pt.renderSample(); await frame(); }
  return { ms: Math.round(performance.now() - t0), samples };
};
