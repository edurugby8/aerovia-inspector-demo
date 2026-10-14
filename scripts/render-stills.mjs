// Stills rendered from the 3D scene itself: the four acts for wide and portrait screens
// (posters, reduced-motion and no-WebGL versions), the payload-camera capture used by the
// example report, and the share preview. Needs the site running (npm run dev or preview).
//
//   node scripts/render-stills.mjs [--url=http://localhost:5174/aerovia-inspector-demo/]
//
// Writes src/assets/stills/*.webp (hashed by the build) and public/og-image.jpg.
import fs from 'node:fs/promises';
import path from 'node:path';
import { ACT_STILLS } from '../src/experience/config.ts';
import { launchBrowser } from './browser.mjs';

const url = process.argv.find((a) => a.startsWith('--url='))?.slice(6) ?? 'http://localhost:5174/aerovia-inspector-demo/';
const OUT = path.resolve('src/assets/stills');
await fs.mkdir(OUT, { recursive: true });

const NAMES = { presentacion: 'act1', aproximacion: 'act2', inspeccion: 'act3', resultado: 'act4' };
const jobs = [];
for (const [act, p] of Object.entries(ACT_STILLS)) {
  jobs.push({ file: path.join(OUT, `${NAMES[act]}-wide.webp`), w: 1920, h: 1080, dpr: 1, query: `still&p=${p}` });
  jobs.push({ file: path.join(OUT, `${NAMES[act]}-tall.webp`), w: 540, h: 1170, dpr: 2, query: `still&p=${p}` });
}
jobs.push({ file: path.join(OUT, 'capture.webp'), w: 1600, h: 1000, dpr: 1, query: `still&payload&p=${ACT_STILLS.inspeccion}` });
jobs.push({ file: path.resolve('public/og-image.jpg'), w: 1200, h: 630, dpr: 1, query: `still&p=${ACT_STILLS.inspeccion}`, jpeg: true });

const browser = await launchBrowser();
for (const job of jobs) {
  const page = await browser.newPage();
  await page.setViewport({ width: job.w, height: job.h, deviceScaleFactor: job.dpr });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${url}?${job.query}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.xp') && !document.querySelector('.load'), { timeout: 90000 });
  // only the scene: no texts, labels or header in the image
  await page.addStyleTag({ content: '.site-header,.act,.annotations,.load,.xp-skip,.xp-shade,.xp-poster{display:none!important}' });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot(job.jpeg ? { path: job.file, type: 'jpeg', quality: 86 } : { path: job.file, type: 'webp', quality: 82 });
  const { size } = await fs.stat(job.file);
  console.log(`${path.relative(process.cwd(), job.file)}  ${job.w * job.dpr}×${job.h * job.dpr}  ${Math.round(size / 1024)} KB${errors.length ? `  errors: ${errors.join(' | ')}` : ''}`);
  await page.close();
}
await browser.close();
