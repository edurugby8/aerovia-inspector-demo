// Runs the composition search page and prints the best camera fits.
//   node scripts/propuestas-solve.mjs "drone:0.64:0.34,le36:0.95:0.88,le44:0.62:0.64" [--box=…] [--fov=24,60] [--aspect=1.6] [--n=40000]
import { launchBrowser } from './browser.mjs';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const params = new URLSearchParams({ targets: process.argv[2], box: arg('box', '-60,-20,96,108,9,40'), fov: arg('fov', '24,60'), aspect: arg('aspect', '1.6'), n: arg('n', '40000') });
if (arg('hover', null)) params.set('hover', arg('hover', null));
const browser = await launchBrowser();
const page = await browser.newPage();
await page.goto(`http://localhost:5174/aerovia-inspector-demo/propuestas/solve.html?${params}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => window.__solve, { timeout: 600000, polling: 500 });
for (const r of await page.evaluate(() => window.__solve)) console.log(r.err.toFixed(4), `cam=${r.cam.join(',')}`, `fov=${r.fov}`);
await browser.close();
