// Quick raster previews of many camera candidates, to choose cover compositions by eye.
//   node scripts/propuestas-candidatos.mjs <candidates.json> [--w=800 --h=450 --out=e2e/out/cands]
// candidates.json: [{ "name": "a1", "shot": "a", "fmt": "wide", "cam": "x,y,z", "look": "x,y,z", "fov": 30, "tm": "agx", "exp": 1 }]
import fs from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser } from './browser.mjs';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const list = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
const base = arg('url', 'http://localhost:5174/aerovia-inspector-demo/');
const out = path.resolve(arg('out', 'e2e/out/cands'));
await fs.mkdir(out, { recursive: true });
const browser = await launchBrowser(['--force_high_performance_gpu']);
for (const c of list) {
  const [w, h] = c.size ? c.size : c.fmt === 'tall' ? [360, 780] : [Number(arg('w', '800')), Number(arg('h', '450'))];
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  const params = new URLSearchParams({ mode: c.mode ?? 'raster', w: String(w), h: String(h), spp: String(c.spp ?? 32) });
  for (const k of ['shot', 'fmt', 'cam', 'camOn', 'look', 'aim', 'fov', 'tm', 'exp', 'hover', 'sun', 'roll', 'props', 'sky', 'skyaz', 'skyexp', 'studio', 'camAround']) if (c[k] !== undefined) params.set(k, String(c[k]));
  await page.goto(`${base}propuestas/render.html?${params}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__done, { timeout: 600000, polling: 200 });
  const file = path.join(out, `${c.name}.png`);
  await (await page.$('canvas')).screenshot({ path: file });
  console.log(file);
  await page.close();
}
await browser.close();
