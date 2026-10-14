// Contact sheet of screenshots: node e2e/sheet.mjs <out.jpg> <height> <file> [file…]
import fs from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser } from '../scripts/browser.mjs';

const [out, height, ...files] = process.argv.slice(2);
const imgs = await Promise.all(files.map(async (f) => `data:image/png;base64,${(await fs.readFile(f)).toString('base64')}`));
const browser = await launchBrowser();
const page = await browser.newPage();
await page.setViewport({ width: 2400, height: 400 });
await page.setContent(`<body style="margin:0;padding:8px;background:#222;font:12px monospace;color:#ccc;display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">${imgs.map((src, i) => `<figure style="margin:0"><img src="${src}" style="height:${height}px;display:block"><figcaption>${path.basename(files[i])}</figcaption></figure>`).join('')}</body>`);
await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
await page.screenshot({ path: out, type: 'jpeg', quality: 85, fullPage: true });
await browser.close();
console.log(out);
