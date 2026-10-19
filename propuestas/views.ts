// Many quick raster views of one scene, built once: for choosing framings by eye.
// scripts/propuestas-vistas.mjs passes the views and saves each image.
//   views.html?studio=1  then  window.__render({ w, h, hover, camAround|cam, aim, roll, fov, exp }) → PNG data URL
import * as THREE from 'three';
import { bladeSurfaceWorld } from '../src/experience/models/turbine';
import { aimAt } from './aim';
import { parseHover } from './hover';
import { buildProposalScene } from './scene';

declare global { interface Window { __render?: (v: View) => string; __ready?: boolean } }
/** `target`: a point on blade B ([r, q]) placed at `aim` instead of the drone */
interface View { w: number; h: number; hover: string; camAround?: number[]; cam?: number[]; aim: number[]; target?: number[]; roll?: number; fov: number; exp?: number }

const q = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.style.margin = '0';
document.body.appendChild(renderer.domElement);
const { scene, poseDrone } = buildProposalScene({ studio: q.get('studio') === '1', props: 'smear', lite: true });
const camera = new THREE.PerspectiveCamera(40, 1.6, 0.05, 20000);

window.__render = (v) => {
  renderer.setSize(v.w, v.h);
  renderer.toneMappingExposure = v.exp ?? 1;
  const pose = poseDrone(0.63, parseHover(v.hover));
  camera.aspect = v.w / v.h;
  camera.fov = v.fov;
  camera.updateProjectionMatrix();
  if (v.camAround) {
    const [az, el] = v.camAround.slice(0, 2).map(THREE.MathUtils.degToRad);
    camera.position.copy(pose.position).add(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(v.camAround[2]));
  } else if (v.cam) camera.position.fromArray(v.cam);
  const point = v.target ? bladeSurfaceWorld('B', v.target[0], v.target[1]) : pose.position;
  aimAt(camera, point, v.aim[0], v.aim[1], THREE.MathUtils.degToRad(v.roll ?? 0));
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/png');
};
window.__ready = true;
