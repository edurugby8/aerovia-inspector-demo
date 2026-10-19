// Quick raster views of the proposal scene, built once in one page (propuestas/views.ts):
//   node scripts/propuestas-vistas.mjs <views.json> <out.jpg> [--studio=1] [--height=260]
// views.json: [{ "name": "h1", "w": 800, "h": 500, "hover": "B:44,1.2,4.6,auto,44,0.47", "camAround": [-70, 10, 4], "aim": [0.6, 0.45], "fov": 40 }]
// Writes every view to e2e/out/vistas/<name>.png and a contact sheet to <out.jpg>.
import fs from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser } from './browser.mjs';

const [list, sheet] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const views = JSON.parse((await fs.readFile(list, 'utf8')).replace(/^﻿/, ''));
const dir = path.resolve('e2e/out/vistas');
await fs.mkdir(dir, { recursive: true });
const browser = await launchBrowser(['--force_high_performance_gpu']);
const page = await browser.newPage();
// a module that fails to load (a 500 from the dev server) leaves the page waiting forever: stop at once
let failed = '';
page.on('pageerror', (e) => { failed ||= String(e); });
page.on('response', (r) => { if (r.status() >= 400) failed ||= `${r.status()} ${r.url()}`; });
await page.goto(`http://localhost:5174/aerovia-inspector-demo/propuestas/views.html?studio=${arg('studio', '1')}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
for (const t0 = Date.now(); !(await page.evaluate(() => !!window.__ready)); await new Promise((r) => setTimeout(r, 300))) {
  if (failed) { console.log('page failed:', failed); await browser.close(); process.exit(1); }
  if (Date.now() - t0 > 300000) { console.log('timed out waiting for the scene'); await browser.close(); process.exit(1); }
}
const shots = [];
for (const v of views) {
  const url = await page.evaluate((v) => window.__render(v), v);
  const file = path.join(dir, `${v.name}.png`);
  await fs.writeFile(file, Buffer.from(url.split(',')[1], 'base64'));
  shots.push({ name: v.name, url });
}
const h = Number(arg('height', '260'));
await page.setViewport({ width: 2400, height: 400 });
await page.setContent(`<body style="margin:0;padding:8px;background:#222;font:12px monospace;color:#ccc;display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">${shots.map((s) => `<figure style="margin:0"><img src="${s.url}" style="height:${h}px;display:block"><figcaption>${s.name}</figcaption></figure>`).join('')}</body>`);
await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
await page.screenshot({ path: sheet, type: 'jpeg', quality: 85, fullPage: true });
await browser.close();
console.log(sheet);
