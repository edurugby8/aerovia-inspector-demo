// Fetches the sky used by the proposal renders into propuestas/hdri/ (not committed) and checks it
// against the size and MD5 that Poly Haven publishes for it.
//   node scripts/descargar-hdri.mjs
// «Evening Road 01 (Pure Sky)» by Sergej Majboroda (original) and Jarod Guest (sky edits),
// Poly Haven, CC0: any use, commercial included; no attribution required.
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const FILE = {
  url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/4k/evening_road_01_puresky_4k.hdr',
  size: 18692813,
  md5: '3461499a68e8fe03ec42592f4bc2d5ef',
};
const out = path.resolve('propuestas/hdri', path.basename(FILE.url));
const md5 = (buf) => createHash('md5').update(buf).digest('hex');

try {
  const have = await fs.readFile(out);
  if (have.length === FILE.size && md5(have) === FILE.md5) { console.log(`${path.relative(process.cwd(), out)} already there and verified`); process.exit(0); }
} catch { /* not downloaded yet */ }

const res = await fetch(FILE.url);
if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${FILE.url}`);
const buf = Buffer.from(await res.arrayBuffer());
if (buf.length !== FILE.size || md5(buf) !== FILE.md5) throw new Error(`unexpected file: ${buf.length} bytes, md5 ${md5(buf)}`);
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(out, buf);
console.log(`${path.relative(process.cwd(), out)}  ${buf.length} bytes, md5 ${FILE.md5}`);
