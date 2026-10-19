// A look at the HDRI: a tone-mapped preview of the whole sky (equirect, 0° azimuth in the middle)
// with the horizon, 30° and 60° lines and the sun marked; its numbers go to window.__sky.
import { loadSky } from './environment';

declare global { interface Window { __sky?: unknown } }

const sky = await loadSky();
const { width: W, height: H, data } = sky.texture.image as { width: number; height: number; data: Float32Array };
const w = 1600, h = 800, c = document.createElement('canvas');
c.width = w; c.height = h;
document.body.style.margin = '0';
document.body.appendChild(c);
const g = c.getContext('2d')!;
const img = g.createImageData(w, h);
const exposure = Number(new URLSearchParams(location.search).get('exp') ?? 1);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const sx = Math.floor((x / w) * W), sy = Math.floor((y / h) * H);
  const row = sky.texture.flipY ? sy : H - 1 - sy; // draw with the zenith at the top
  const i = (row * W + sx) * 4, o = (y * w + x) * 4;
  for (let k = 0; k < 3; k++) { const v = data[i + k] * exposure; img.data[o + k] = 255 * Math.pow(v / (1 + v), 1 / 2.2); }
  img.data[o + 3] = 255;
}
g.putImageData(img, 0, 0);
g.strokeStyle = 'rgba(255,255,255,0.5)';
g.font = '14px monospace';
g.fillStyle = 'white';
for (const deg of [0, 30, 60]) {
  const y = h * (0.5 - deg / 180);
  g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
  g.fillText(`${deg}°`, 6, y - 4);
}
const u = Math.atan2(sky.sun.z, sky.sun.x) / (2 * Math.PI) + 0.5, v = 0.5 - sky.sunElevation / 180;
g.strokeStyle = '#ff3b30'; g.lineWidth = 2;
g.beginPath(); g.arc(u * w, v * h, 14, 0, Math.PI * 2); g.stroke();
window.__sky = { width: W, height: H, flipY: sky.texture.flipY, sun: sky.sun.toArray().map((n) => +n.toFixed(4)), sunElevation: +sky.sunElevation.toFixed(2), sunAzimuthFromZ: +((Math.atan2(sky.sun.x, sky.sun.z) * 180) / Math.PI).toFixed(1) };
