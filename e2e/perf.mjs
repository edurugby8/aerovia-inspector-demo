// What the brief asks to report about weight and speed, measured on the production build:
//   npm run build && npm run preview
//   node e2e/perf.mjs [--url=http://localhost:4174/aerovia-inspector-demo/] [--seconds=8]
// For each format: bytes transferred (the page, the 3D code, the total), time to the first 3D
// frame, and frame times while the page scrolls through the whole experience. Frames are not
// capped at the display rate in headless mode, so FPS above 60 means headroom.
// Headless Chromium on this machine's GPU: a phone-sized window is not a phone, so the mobile
// rows are also run with the CPU slowed down 4× and a simulated 4G network, labelled as such.
import { launchBrowser } from '../scripts/browser.mjs';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const url = arg('url', 'http://localhost:4174/aerovia-inspector-demo/');
const seconds = Number(arg('seconds', '8'));
const RUNS = [
  { name: 'escritorio 1440×900', w: 1440, h: 900, dpr: 1 },
  { name: 'escritorio 1920×1080', w: 1920, h: 1080, dpr: 1 },
  { name: 'ventana móvil 390×844 @3x', w: 390, h: 844, dpr: 3, mobile: true },
  { name: 'ventana móvil 390×844 @3x, CPU ×4 más lenta', w: 390, h: 844, dpr: 3, mobile: true, cpu: 4 },
  { name: 'ventana móvil, CPU ×4 y red 4G simulada (9 Mbit/s, 150 ms)', w: 390, h: 844, dpr: 3, mobile: true, cpu: 4, net: { latency: 150, down: 9e6 / 8, up: 1.5e6 / 8 } },
];
const kb = (n) => `${Math.round(n / 1024)} KB`;

const browser = await launchBrowser();
const rows = [];
let gpu = '';
for (const run of RUNS) {
  const page = await browser.newPage();
  await page.setViewport({ width: run.w, height: run.h, deviceScaleFactor: run.dpr, isMobile: !!run.mobile, hasTouch: !!run.mobile });
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (run.cpu) await cdp.send('Emulation.setCPUThrottlingRate', { rate: run.cpu });
  if (run.net) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: run.net.latency, downloadThroughput: run.net.down, uploadThroughput: run.net.up });
  const reqs = new Map();
  cdp.on('Network.requestWillBeSent', (e) => { reqs.set(e.requestId, { url: e.request.url, bytes: 0 }); });
  cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) r.bytes = e.encodedDataLength; });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const dcl = Date.now() - t0;
  await page.waitForFunction(() => document.querySelector('.xp') && !document.querySelector('.load'), { timeout: 120000 });
  const ready = Date.now() - t0;
  await new Promise((r) => setTimeout(r, 500));
  const all = [...reqs.values()];
  const scene = all.filter((r) => /\/Scene-[\w-]+\.js/.test(r.url)).reduce((s, r) => s + r.bytes, 0);
  const total = all.reduce((s, r) => s + r.bytes, 0);
  if (!gpu) gpu = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'desconocida';
  });
  // scroll through the whole track at an even pace and time every frame
  const frames = await page.evaluate((seconds) => new Promise((resolve) => {
    const xp = document.querySelector('.xp');
    const top = xp.getBoundingClientRect().top + scrollY, span = xp.offsetHeight - innerHeight;
    const times = [];
    let start = 0, last = 0;
    const step = (t) => {
      if (!start) { start = t; last = t; }
      else { times.push(t - last); last = t; }
      const k = Math.min(1, (t - start) / (seconds * 1000));
      window.scrollTo({ top: top + k * span, behavior: 'instant' });
      if (k < 1) requestAnimationFrame(step); else resolve(times);
    };
    requestAnimationFrame(step);
  }), seconds);
  const sorted = [...frames].sort((a, b) => a - b);
  const avg = frames.reduce((s, x) => s + x, 0) / frames.length;
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const canvas = await page.evaluate(() => { const c = document.querySelector('.xp-canvas canvas'); return c ? `${c.width}×${c.height}` : '—'; });
  rows.push(`| ${run.name} | ${kb(total - scene)} | ${kb(scene)} | ${kb(total)} | ${(dcl / 1000).toFixed(1)} s | ${(ready / 1000).toFixed(1)} s | ${canvas} | ${(1000 / avg).toFixed(0)} | ${p95.toFixed(1)} ms | ${frames.filter((x) => x > 50).length} |`);
  console.log(rows.at(-1));
  await page.close();
}
await browser.close();
console.log(`\nGPU (WebGL): ${gpu}\n`);
console.log('| Formato | Página sin el 3D | Código 3D | Total transferido | DOMContentLoaded | Primer fotograma 3D | Lienzo (px) | FPS medios | Fotograma p95 | Fotogramas > 50 ms |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
console.log(rows.join('\n'));
