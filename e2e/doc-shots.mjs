// The screenshots in docs/screenshots: the four acts as a visitor sees them (texts, labels
// and header included), on a desktop window and on a phone-sized one, with ambient motion
// off so propellers are not caught mid-blur.
//   node e2e/doc-shots.mjs [--url=http://localhost:4174/aerovia-inspector-demo/]
import fs from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser } from '../scripts/browser.mjs';
import { ACT_STILLS } from '../src/experience/config.ts';
import { openExperience, scrollToProgress } from './helpers.mjs';

const url = process.argv.find((a) => a.startsWith('--url='))?.slice(6) ?? 'http://localhost:4174/aerovia-inspector-demo/';
const OUT = path.resolve('docs/screenshots');
await fs.mkdir(OUT, { recursive: true });
const FORMATS = [['escritorio', 1440, 900], ['movil', 390, 844]];

const browser = await launchBrowser();
for (const [label, w, h] of FORMATS) {
  const { page, errors } = await openExperience(browser, `${url}?still`, w, h);
  for (const [i, p] of Object.values(ACT_STILLS).entries()) {
    await scrollToProgress(page, p, 500);
    const file = path.join(OUT, `acto-${i + 1}-${label}.webp`);
    await page.screenshot({ path: file, type: 'webp', quality: 86 });
    const { size } = await fs.stat(file);
    console.log(`${path.relative(process.cwd(), file)}  ${Math.round(size / 1024)} KB`);
  }
  if (errors.length) console.log('errors:', errors.join(' | '));
  await page.close();
}
await browser.close();
