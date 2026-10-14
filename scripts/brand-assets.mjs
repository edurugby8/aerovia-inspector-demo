// Display copies of the original logo, made reproducibly from aerovia-logo-original.png:
// the empty margins are trimmed and the result is scaled proportionally. Nothing is
// redrawn, recoloured or distorted; the light background stays as it is.
//
//   node scripts/brand-assets.mjs
//
// Writes src/assets/brand/{aerovia-logo.webp, aerovia-symbol.webp} and
// public/{favicon.png, apple-touch-icon.png}.
import fs from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser } from './browser.mjs';

const src = path.resolve('aerovia-logo-original.png');
const data = `data:image/png;base64,${(await fs.readFile(src)).toString('base64')}`;
const browser = await launchBrowser();
const page = await browser.newPage();

const outputs = await page.evaluate(async (data) => {
  const img = new Image(); img.src = data; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const bg = [d[0], d[1], d[2]];
  const ink = (x, y) => { const i = (y * c.width + x) * 4; return Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 60; };
  // bounding box of everything, and of the symbol (the tallest block of rows on top)
  let minX = c.width, minY = c.height, maxX = 0, maxY = 0;
  const rowInk = [];
  for (let y = 0; y < c.height; y++) {
    let any = false;
    for (let x = 0; x < c.width; x++) if (ink(x, y)) { any = true; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    rowInk.push(any);
  }
  let symEnd = minY; while (rowInk[symEnd + 1]) symEnd++;
  let sMinX = c.width, sMaxX = 0;
  for (let y = minY; y <= symEnd; y++) for (let x = 0; x < c.width; x++) if (ink(x, y)) { if (x < sMinX) sMinX = x; if (x > sMaxX) sMaxX = x; }
  // square = the region fitted inside a square of the logo's own background colour
  const crop = (x0, y0, x1, y1, outH, { square = false, type = 'image/png', quality } = {}) => {
    const w = x1 - x0, h = y1 - y0;
    const W = square ? outH : Math.round(w * (outH / h)), H = outH;
    const scale = Math.min(W / w, H / h);
    const o = document.createElement('canvas'); o.width = W; o.height = H;
    const octx = o.getContext('2d');
    octx.fillStyle = `rgb(${bg.join(',')})`; octx.fillRect(0, 0, W, H);
    octx.imageSmoothingQuality = 'high';
    const dw = w * scale, dh = h * scale;
    octx.drawImage(c, x0, y0, w, h, (W - dw) / 2, (H - dh) / 2, dw, dh);
    return o.toDataURL(type, quality);
  };
  const m = 36; // breathing room around the ink, in source pixels
  const sym = [sMinX - m, minY - m, sMaxX + m, symEnd + m];
  const tight = [sMinX - 12, minY - 12, sMaxX + 12, symEnd + 12];
  return {
    box: { all: [minX, minY, maxX, maxY], symbol: [sMinX, minY, sMaxX, symEnd], background: bg },
    logo: crop(minX - m, minY - m, maxX + m, maxY + m, 480, { type: 'image/webp', quality: 0.95 }),
    symbol: crop(...sym, 160, { type: 'image/webp', quality: 0.95 }),
    favicon: crop(...tight, 64, { square: true }),
    touch: crop(...tight, 180, { square: true }),
  };
}, data);

const write = async (file, url) => { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, Buffer.from(url.split(',')[1], 'base64')); };
await write('src/assets/brand/aerovia-logo.webp', outputs.logo);
await write('src/assets/brand/aerovia-symbol.webp', outputs.symbol);
await write('public/favicon.png', outputs.favicon);
await write('public/apple-touch-icon.png', outputs.touch);
console.log(JSON.stringify(outputs.box));
await browser.close();
