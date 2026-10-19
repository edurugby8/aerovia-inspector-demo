// Renders the motion test (propuestas/sequence.ts) frame by frame in a headless browser; needs
// `npm run dev` running.
//   node scripts/render-secuencia.mjs --frames=96 --w=1280 --h=800 --spp=192 [--from=0 --to=95]
//        [--mode=raster] [--start=mobile] [--out=e2e/out/secuencia]
// Saves out/f0000.png … and skips frames already on disk, so an interrupted run can resume.
import fs from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser } from './browser.mjs';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const n = Number(arg('frames', '96')), from = Number(arg('from', '0')), to = Number(arg('to', String(n - 1)));
const w = Number(arg('w', '1280')), h = Number(arg('h', '800'));
const out = path.resolve(arg('out', 'e2e/out/secuencia'));
await fs.mkdir(out, { recursive: true });
const params = new URLSearchParams({ w: String(w), h: String(h), spp: arg('spp', '192') });
for (const k of ['mode', 'start', 'exp', 'seed', 'sky', 'skyaz', 'skyexp', 'studio', 'motion']) { const val = arg(k, null); if (val !== null) params.set(k, val); }

const browser = await launchBrowser(['--force_high_performance_gpu', '--enable-unsafe-webgpu', '--disable-gpu-watchdog']);
const page = await browser.newPage();
await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('page error:', String(e)));
// no hot reload: editing any page of the project while frames render must not reload this one
await page.setRequestInterception(true);
page.on('request', (r) => (r.url().includes('/@vite/client') ? r.abort() : r.continue()));
await page.goto(`${arg('url', 'http://localhost:5174/aerovia-inspector-demo/')}propuestas/sequence.html?${params}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => window.__ready, { timeout: 600000, polling: 500 });
const canvas = await page.$('canvas');
const t0 = Date.now();
let done = 0;
for (let i = from; i <= to; i++) {
  const file = path.join(out, `f${String(i).padStart(4, '0')}.png`);
  try { await fs.access(file); continue; } catch { /* not rendered yet */ }
  const info = await page.evaluate((i, n) => window.__frame(i, n), i, n);
  await canvas.screenshot({ path: file });
  done++;
  const left = ((Date.now() - t0) / done) * (to - i) / 60000;
  console.log(`f${String(i).padStart(4, '0')}  ${info.samples} spp  ${(info.ms / 1000).toFixed(1)} s  (~${left.toFixed(0)} min left)`);
}
await browser.close();
