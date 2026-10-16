// Runs the cover composition search (propuestas/compose.ts) and prints the best frames; with
// --cands=<file> it also writes them as a candidates list for propuestas-candidatos.mjs.
//   node scripts/propuestas-compose.mjs --aspect=1.6 --n=60000 [--text=…] [--droneAt=…] [--cands=e2e/out/c.json --size=800,500]
import fs from 'node:fs/promises';
import { launchBrowser } from './browser.mjs';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const params = new URLSearchParams();
for (const k of ['aspect', 'n', 'text', 'droneAt', 'cov', 'fov', 'box', 'hover', 'size', 'steep', 'ground', 'seed', 'top', 'roll', 'overlap']) { const val = arg(k, null); if (val !== null) params.set(k, val); }
const browser = await launchBrowser();
const page = await browser.newPage();
await page.goto(`${arg('url', 'http://localhost:5174/aerovia-inspector-demo/')}propuestas/compose.html?${params}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => window.__compose, { timeout: 30 * 60 * 1000, polling: 500 });
const { tried, picked, aimErr } = await page.evaluate(() => window.__compose);
await browser.close();
console.log(`${tried} frames scored (${aimErr} dropped: aim did not converge)`);
for (const r of picked) console.log(r.err.toFixed(4), `cam=${r.cam.join(',')}`, `fov=${r.fov}`, `aim=${r.aim.join(',')}`, `roll=${r.roll}`, r.against ? 'on-blade' : 'on-sky', `hover=${r.hover}`, `cov=${r.cov} size=${r.size} steep=${r.steep} ground=${r.ground} text=${r.textHit} le=${r.leNear}`);
const cands = arg('cands', null);
if (cands) {
  const [w, h] = arg('frame', '800,500').split(',').map(Number);
  const prefix = arg('prefix', 'K');
  const sun = arg('sun', '0.7,0.32,0.64');
  await fs.writeFile(cands, JSON.stringify(picked.map((r, i) => ({ name: `${prefix}${i + 1}`, fmt: 'wide', size: [w, h], cam: r.cam.join(','), aim: r.aim.join(','), roll: r.roll, fov: r.fov, hover: r.hover, sun })), null, 1));
  console.log(cands);
}
