// Renders one frame of a cover proposal. Query parameters:
//   shot=a|b  fmt=wide|tall  w, h (pixels)  spp (path-traced samples)  mode=pt|raster|anchors
//   cam=x,y,z look=x,y,z fov=deg  (override the shot's camera while composing)
// When finished it sets window.__done = { ms, samples } and, for the HTML layer, the screen
// positions of the drone, the defect and the capture zone in window.__overlay (0…1).
import * as THREE from 'three';
import { WebGLPathTracer } from 'three-gpu-pathtracer';
import { DEFECT, bladeSurfaceWorld } from '../src/experience/models/turbine';
import { HUB } from '../src/experience/trajectory';
import { aimAt } from './aim';
import { parseHover } from './hover';
import { skyFromQuery } from './environment';
import { buildProposalScene, type PropLook } from './scene';
import { SHOTS, type ShotName, type Format } from './shots';

declare global { interface Window { __done?: { ms: number; samples: number }; __overlay?: unknown; __anchors?: unknown; __progress?: unknown } }

const q = new URLSearchParams(location.search);
const name = (q.get('shot') ?? 'a') as ShotName, fmt = (q.get('fmt') ?? 'wide') as Format;
const W = Number(q.get('w') ?? 1600), H = Number(q.get('h') ?? 900), SPP = Number(q.get('spp') ?? 64), mode = q.get('mode') ?? 'pt';
const vec = (s: string | null) => (s ? new THREE.Vector3(...s.split(',').map(Number)) : null);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
const TONE = { agx: THREE.AgXToneMapping, neutral: THREE.NeutralToneMapping, aces: THREE.ACESFilmicToneMapping } as const;
renderer.toneMapping = TONE[(q.get('tm') ?? 'agx') as keyof typeof TONE];
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const sunQ = q.get('sun')?.split(',').map(Number);
const { scene, poseDrone } = buildProposalScene({ ...(sunQ ? { sunDir: new THREE.Vector3(sunQ[0], sunQ[1], sunQ[2]) } : {}), props: (q.get('props') ?? 'smear') as PropLook, sky: await skyFromQuery(q), studio: q.get('studio') === '1' });
const shot = SHOTS[name][fmt];
renderer.toneMappingExposure = Number(q.get('exp') ?? shot.exposure);
const pose = poseDrone(shot.p, parseHover(q.get('hover')));
const camera = new THREE.PerspectiveCamera(Number(q.get('fov') ?? shot.fov), W / H, 0.05, 20000);
const placed = shot.camera(pose);
// camOn=r,q,dx,dy,dz: a camera placed relative to a point on blade B's surface
const camOn = q.get('camOn')?.split(',').map(Number);
camera.position.copy(camOn ? bladeSurfaceWorld('B', camOn[0], camOn[1]).add(new THREE.Vector3(camOn[2], camOn[3], camOn[4])) : vec(q.get('cam')) ?? placed.position);
// camAround=az,el,dist: the camera around the drone (degrees; azimuth from +z towards +x)
const around = q.get('camAround')?.split(',').map(Number);
if (around) { const [az, el] = around.slice(0, 2).map(THREE.MathUtils.degToRad); camera.position.copy(pose.position).add(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(around[2])); }
const aim = q.get('aim')?.split(',').map(Number);
if (aim) aimAt(camera, pose.position, aim[0], aim[1], THREE.MathUtils.degToRad(Number(q.get('roll') ?? 0))); else camera.lookAt(vec(q.get('look')) ?? placed.look);
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
window.__anchors = {
  drone: pose.position.toArray().map((v) => +v.toFixed(2)),
  defect: defect.toArray().map((v) => +v.toFixed(2)),
  le30: bladeSurfaceWorld('B', 30, 0.5).toArray().map((v) => +v.toFixed(2)),
  le40: bladeSurfaceWorld('B', 40, 0.5).toArray().map((v) => +v.toFixed(2)),
  le50: bladeSurfaceWorld('B', 50, 0.5).toArray().map((v) => +v.toFixed(2)),
  le58: bladeSurfaceWorld('B', 58, 0.5).toArray().map((v) => +v.toFixed(2)),
  la30: bladeSurfaceWorld('A', 30, 0.5).toArray().map((v) => +v.toFixed(2)),
  la40: bladeSurfaceWorld('A', 40, 0.5).toArray().map((v) => +v.toFixed(2)),
  la40te: bladeSurfaceWorld('A', 40, 0.0).toArray().map((v) => +v.toFixed(2)),
  la50: bladeSurfaceWorld('A', 50, 0.5).toArray().map((v) => +v.toFixed(2)),
  hub: HUB.toArray(),
  camera: camera.position.toArray().map((v) => +v.toFixed(2)),
};

if (mode === 'raster' || mode === 'anchors') {
  renderer.render(scene, camera);
  window.__done = { ms: 0, samples: 0 };
} else {
  const pt = new WebGLPathTracer(renderer);
  pt.tiles.set(2, 2);
  pt.minSamples = 0;
  pt.renderDelay = 0;
  pt.fadeDuration = 0;
  pt.bounces = 6;
  pt.filterGlossyFactor = 0.2;
  pt.renderToCanvas = true;
  const tScene = performance.now();
  pt.setScene(scene, camera);
  const t0 = performance.now();
  window.__progress = { stage: 'scene ready', sceneMs: Math.round(t0 - tScene), samples: 0, ms: 0 };
  const step = () => {
    pt.renderSample();
    window.__progress = { stage: 'sampling', sceneMs: Math.round(t0 - tScene), samples: pt.samples, ms: Math.round(performance.now() - t0) };
    if (pt.samples < SPP) setTimeout(step, 0);
    else window.__done = { ms: Math.round(performance.now() - t0), samples: pt.samples };
  };
  step();
}
