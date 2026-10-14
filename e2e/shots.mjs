// Screenshots of the experience at chosen progress values and viewport sizes.
//   node e2e/shots.mjs [--url=http://localhost:5174/aerovia-inspector-demo/] [--out=e2e/out/shots]
//                      [--sizes=1440x900,390x844] [--ps=0.04,0.42,0.63,0.97] [--name=act]
import fs from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser } from '../scripts/browser.mjs';
import { openExperience, scrollToProgress } from './helpers.mjs';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const url = arg('url', 'http://localhost:5174/aerovia-inspector-demo/');
const out = path.resolve(arg('out', 'e2e/out/shots'));
const sizes = arg('sizes', '1440x900,390x844').split(',').map((s) => s.split('x').map(Number));
const ps = arg('ps', '0.04,0.42,0.63,0.97').split(',').map(Number);
const name = arg('name', 'p');
await fs.mkdir(out, { recursive: true });

const browser = await launchBrowser();
for (const [w, h] of sizes) {
  const { page, errors } = await openExperience(browser, url, w, h);
  for (const p of ps) {
    await scrollToProgress(page, p);
    const file = path.join(out, `${name}-${w}x${h}-${String(p).replace('.', '_')}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  }
  if (errors.length) console.log('errors:', errors.join(' | '));
  await page.close();
}
await browser.close();
