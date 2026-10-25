// Screenshots of the cover proposals as a visitor would see them, on a desktop window and on a
// phone-sized one (needs `npm run dev`). Writes docs/propuestas/propuesta-<p>-{escritorio,movil}.webp
//   node scripts/propuestas-capturas.mjs [a b a2]   (default: a b)
// Other pages: --page=inicio --dir=docs/rediseno-web [--full] writes <dir>/inicio-{escritorio,movil}.webp
// from propuestas/inicio.html; --full captures the whole page instead of the first screen.
import fs from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser } from './browser.mjs';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const base = arg('url', 'http://localhost:5174/aerovia-inspector-demo/');
const names = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const single = arg('page', null), full = process.argv.includes('--full');
const OUT = path.resolve(arg('dir', 'docs/propuestas'));
await fs.mkdir(OUT, { recursive: true });
const FORMATS = [['escritorio', 1440, 900, 2, false], ['movil', 390, 844, 3, true]];
const jobs = single ? [{ url: `${single}.html`, file: (label) => `${single}-${label}.webp` }]
  : (names.length ? names : ['a', 'b']).map((p) => ({ url: `portada-${p}.html`, file: (label) => `propuesta-${p}-${label}.webp` }));
const browser = await launchBrowser();
for (const job of jobs) {
  for (const [label, w, h, dpr, mobile] of FORMATS) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await page.goto(`${base}propuestas/${job.url}`, { waitUntil: 'networkidle0', timeout: 120000 });
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
    const file = path.join(OUT, job.file(label));
    await page.screenshot({ path: file, type: 'webp', quality: 88, fullPage: full });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    console.log(`${path.relative(process.cwd(), file)}  ${Math.round((await fs.stat(file)).size / 1024)} KB  overflow ${overflow}px${errors.length ? `  errors: ${errors.join(' | ')}` : ''}`);
    await page.close();
  }
}
await browser.close();
