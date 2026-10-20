// The site's pictures from the studio renders in docs/rediseno-web/render:
//   node scripts/site-images.mjs
// Copies each render to src/assets/site (the build hashes them), adds a half-size version for
// narrow screens and cards, and cuts the 1200×630 share image (public/og-image.jpg) from the cover.
import fs from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser } from './browser.mjs';

const SRC = path.resolve('docs/rediseno-web/render'), OUT = path.resolve('src/assets/site');
// name: half-size width (0 = none)
const IMAGES = { 'inicio-escritorio': 1280, 'inicio-movil': 0, dron: 1200, 'momento-2': 1200, detalle: 1200, captura: 1200 };

await fs.mkdir(OUT, { recursive: true });
const browser = await launchBrowser();
const page = await browser.newPage();
/** Draws a region of an image into a w×h canvas and encodes it. */
const draw = (file, w, h, type, quality, crop) => fs.readFile(file).then((buf) => page.evaluate(async (src, w, h, type, quality, crop) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  const [sx, sy, sw, sh] = crop ?? [0, 0, img.naturalWidth, img.naturalHeight];
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  return c.toDataURL(type, quality);
}, `data:image/webp;base64,${buf.toString('base64')}`, w, h, type, quality, crop));
const save = (file, url) => fs.writeFile(file, Buffer.from(url.split(',')[1], 'base64'));

for (const [name, half] of Object.entries(IMAGES)) {
  const src = path.join(SRC, `${name}.webp`);
  await fs.copyFile(src, path.join(OUT, `${name}.webp`));
  if (half) {
    const { w: width, h: height } = JSON.parse(await fs.readFile(path.join(SRC, `${name}.json`), 'utf8')).params;
    await save(path.join(OUT, `${name}-${half}.webp`), await draw(src, half, Math.round((half * height) / width), 'image/webp', 0.86));
  }
  console.log(name);
}
// share image: the cover cut to 1.9:1 around the drone
const cover = path.join(SRC, 'inicio-escritorio.webp');
const { w: cw, h: ch } = await fs.readFile(path.join(SRC, 'inicio-escritorio.json'), 'utf8').then((t) => { const p = JSON.parse(t).params; return { w: +p.w, h: +p.h }; });
const cropH = Math.round((cw * 630) / 1200);
await save(path.resolve('public/og-image.jpg'), await draw(cover, 1200, 630, 'image/jpeg', 0.88, [0, Math.round((ch - cropH) * 0.45), cw, cropH]));
console.log('og-image');
await browser.close();
