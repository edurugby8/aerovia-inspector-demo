// Encodes a folder of PNG frames into a video in the browser (MediaRecorder; no ffmpeg needed):
//   node scripts/encode-video.mjs <frames-dir> <out.webm|out.mp4> [--fps=24] [--pingpong] [--hold=12] [--mbps=8]
// --pingpong plays the frames forward then back, as scrolling down and up would; --hold repeats
// the first and last frames to pause on them.
import fs from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser } from './browser.mjs';

const [dir, outFile] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const fps = Number(arg('fps', '24')), hold = Number(arg('hold', '0')), pingpong = process.argv.includes('--pingpong');
const bitrate = Number(arg('mbps', '8')) * 1e6;
const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.png')).sort();
if (!files.length) throw new Error(`no frames in ${dir}`);

const browser = await launchBrowser();
const page = await browser.newPage();
await page.goto('about:blank');
await page.evaluate(() => { window.__frames = []; });
for (const f of files) {
  const b64 = (await fs.readFile(path.join(dir, f))).toString('base64');
  await page.evaluate(async (b64) => {
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
    window.__frames.push(await createImageBitmap(blob));
  }, b64);
}
const mp4 = outFile.endsWith('.mp4');
const result = await page.evaluate(async ({ fps, hold, pingpong, mp4, bitrate }) => {
  const types = mp4 ? ['video/mp4;codecs=avc1.640033', 'video/mp4;codecs=avc1.4d0033', 'video/mp4'] : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t));
  if (!mimeType) return { error: `no recorder for ${mp4 ? 'mp4' : 'webm'}` };
  const frames = window.__frames, { width, height } = frames[0];
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const stream = canvas.captureStream(0), track = stream.getVideoTracks()[0];
  const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const order = [...Array(hold).fill(0), ...frames.map((_, i) => i), ...Array(hold).fill(frames.length - 1)];
  if (pingpong) order.push(...frames.map((_, i) => frames.length - 1 - i), ...Array(hold).fill(0));
  ctx.drawImage(frames[0], 0, 0);
  rec.start();
  const t0 = performance.now();
  for (let k = 0; k < order.length; k++) {
    ctx.drawImage(frames[order[k]], 0, 0);
    track.requestFrame();
    const next = t0 + ((k + 1) * 1000) / fps;
    await new Promise((r) => setTimeout(r, Math.max(0, next - performance.now())));
  }
  await new Promise((r) => { rec.onstop = r; rec.stop(); });
  const blob = new Blob(chunks, { type: mimeType });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { mimeType, frames: order.length, b64: btoa(bin) };
}, { fps, hold, pingpong, mp4, bitrate });
await browser.close();
if (result.error) { console.log(result.error); process.exit(1); }
let video = Buffer.from(result.b64, 'base64');
if (!video.length) { console.log(`the recorder produced no data for ${result.mimeType}`); process.exit(1); }
if (!mp4) video = withWebmDuration(video, result.frames / fps);
await fs.writeFile(outFile, video);
console.log(`${outFile}  ${result.frames} frames at ${fps} fps  ${result.mimeType}  ${(video.length / 1e6).toFixed(1)} MB`);

/**
 * MediaRecorder writes WebM without a duration, so players cannot show or seek the length.
 * Adds the Duration element to the segment's Info (in TimecodeScale units).
 */
function withWebmDuration(buf, seconds) {
  const vint = (pos) => { const b = buf[pos]; let len = 1, mask = 0x80; while (len <= 8 && !(b & mask)) { len++; mask >>= 1; } let val = b & (mask - 1); for (let i = 1; i < len; i++) val = val * 256 + buf[pos + i]; return { len, val, unknown: val === 2 ** (7 * len) - 1 }; };
  const id = (pos) => { const b = buf[pos]; let len = 1, mask = 0x80; while (len <= 4 && !(b & mask)) { len++; mask >>= 1; } let v = 0; for (let i = 0; i < len; i++) v = v * 256 + buf[pos + i]; return { len, v }; };
  let pos = 0;
  const header = id(pos), hsize = vint(pos + header.len);
  pos += header.len + hsize.len + hsize.val; // EBML header
  const seg = id(pos);
  if (seg.v !== 0x18538067) return buf;
  const segSize = vint(pos + seg.len);
  if (!segSize.unknown) return buf; // a sized segment would need its size rewritten too
  pos += seg.len + segSize.len;
  for (;;) {
    if (pos >= buf.length) return buf;
    const el = id(pos), size = vint(pos + el.len), body = pos + el.len + size.len;
    if (el.v !== 0x1549a966) { if (size.unknown) return buf; pos = body + size.val; continue; }
    // inside Info: timecode scale (default 1 ms) and any existing duration
    let scale = 1e6, p = body;
    while (p < body + size.val) {
      const c = id(p), cs = vint(p + c.len), cb = p + c.len + cs.len;
      if (c.v === 0x4489) return buf;
      if (c.v === 0x2ad7b1) { scale = 0; for (let i = 0; i < cs.val; i++) scale = scale * 256 + buf[cb + i]; }
      p = cb + cs.val;
    }
    const duration = Buffer.alloc(11);
    duration[0] = 0x44; duration[1] = 0x89; duration[2] = 0x88;
    duration.writeDoubleBE((seconds * 1e9) / scale, 3);
    const newSize = Buffer.alloc(8);
    newSize[0] = 0x01; newSize.writeUIntBE(size.val + duration.length, 2, 6);
    return Buffer.concat([buf.subarray(0, pos + el.len), newSize, buf.subarray(body, body + size.val), duration, buf.subarray(body + size.val)]);
  }
}
