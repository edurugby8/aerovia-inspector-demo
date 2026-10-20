// Renders cover-proposal frames in a headless browser (needs `npm run dev` running).
//   node scripts/render-propuestas.mjs --shot=a --fmt=wide --w=1600 --h=900 --spp=256 [--mode=raster]
//        [--cam=x,y,z --look=x,y,z --fov=30] [--out=docs/propuestas/render-a-wide.png]
// Saves the image, plus the screen positions used by the HTML layer (<out>.json).
import fs from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser } from './browser.mjs';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const base = arg('url', 'http://localhost:5174/aerovia-inspector-demo/');
const w = Number(arg('w', '1600')), h = Number(arg('h', '900'));
const params = new URLSearchParams();
for (const k of ['shot', 'fmt', 'w', 'h', 'spp', 'mode', 'cam', 'camOn', 'look', 'aim', 'fov', 'tm', 'exp', 'hover', 'sun', 'roll', 'props', 'sky', 'skyaz', 'skyexp', 'studio', 'camAround', 'target', 'fstop', 'focus']) { const val = arg(k, null); if (val !== null) params.set(k, val); }
params.set('w', String(w)); params.set('h', String(h));
const out = path.resolve(arg('out', `e2e/out/propuesta-${arg('shot', 'a')}-${arg('fmt', 'wide')}-${arg('mode', 'pt')}.png`));
await fs.mkdir(path.dirname(out), { recursive: true });

// WebGPU path tracer by default (the WebGL one's shader does not compile through ANGLE here)
const webgpu = arg('api', 'webgpu') === 'webgpu';
const flags = webgpu ? ['--force_high_performance_gpu', '--enable-unsafe-webgpu', '--disable-gpu-watchdog'] : ['--force_high_performance_gpu', `--use-angle=${arg('angle', 'd3d11')}`];
const browser = await launchBrowser(flags);
const page = await browser.newPage();
// no hot reload: an edit to the sources while a frame renders must not restart it
await page.setRequestInterception(true);
page.on('request', (r) => (r.url().includes('/@vite/client') ? r.abort() : r.continue()));
await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('error', (e) => errors.push(`crash: ${e}`));
const t0 = Date.now();
const html = webgpu && arg('mode', 'pt') === 'pt' ? 'render-gpu.html' : 'render.html';
await page.goto(`${base}propuestas/${html}?${params}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
const ticker = setInterval(async () => {
  try { console.log(`  ${((Date.now() - t0) / 1000).toFixed(0)} s`, JSON.stringify(await page.evaluate(() => window.__progress ?? null))); } catch { /* page busy */ }
}, 15000);
try {
  await page.waitForFunction(() => window.__done, { timeout: 30 * 60 * 1000, polling: 500 });
} catch (e) {
  console.log('failed:', String(e).split('\n')[0], '\n', errors.join('\n'));
  process.exit(1);
} finally { clearInterval(ticker); }
const info = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const ext = gl?.getExtension('WEBGL_debug_renderer_info');
  return { done: window.__done, overlay: window.__overlay, anchors: window.__anchors, gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '?' };
});
const canvas = await page.$('canvas');
await canvas.screenshot(out.endsWith('.webp') ? { path: out, type: 'webp', quality: 92 } : out.endsWith('.jpg') ? { path: out, type: 'jpeg', quality: 92 } : { path: out });
await fs.writeFile(out.replace(/\.\w+$/, '.json'), JSON.stringify({ params: Object.fromEntries(params), ...info }, null, 2));
console.log(`${path.relative(process.cwd(), out)}  ${info.done.samples} spp  ${(info.done.ms / 1000).toFixed(1)} s render, ${((Date.now() - t0) / 1000).toFixed(1)} s total  [${info.gpu}]`);
console.log('anchors', JSON.stringify(info.anchors));
console.log('overlay', JSON.stringify(info.overlay));
if (errors.length) console.log('console:', errors.slice(0, 8).join('\n  '));
await browser.close();
