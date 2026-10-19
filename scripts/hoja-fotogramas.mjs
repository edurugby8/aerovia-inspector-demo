// A strip of frames from a rendered sequence, labelled with their time, for the docs:
//   node scripts/hoja-fotogramas.mjs <frames-dir> <out.jpg> [--fps=24] [--count=5] [--width=2400]
import fs from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser } from './browser.mjs';

const [dir, out] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const fps = Number(arg('fps', '24')), count = Number(arg('count', '5')), width = Number(arg('width', '2400'));
const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.png')).sort();
const picks = Array.from({ length: count }, (_, k) => Math.round((k * (files.length - 1)) / (count - 1)));
const cells = await Promise.all(picks.map(async (i) => ({
  src: `data:image/png;base64,${(await fs.readFile(path.join(dir, files[i]))).toString('base64')}`,
  label: `${(i / fps).toFixed(1).replace('.', ',')} s`,
})));
const browser = await launchBrowser();
const page = await browser.newPage();
await page.setViewport({ width, height: 400 });
await page.setContent(`<body style="margin:0;background:#071321;font:500 22px Inter,system-ui,sans-serif;color:#c4cfdb">
  <div style="display:grid;grid-template-columns:repeat(${count},1fr);gap:10px;padding:10px">
  ${cells.map((c) => `<figure style="margin:0"><img src="${c.src}" style="width:100%;display:block"><figcaption style="padding:8px 2px 2px">${c.label}</figcaption></figure>`).join('')}
  </div></body>`);
await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
await page.screenshot({ path: out, type: 'jpeg', quality: 86, fullPage: true });
await browser.close();
console.log(out);
