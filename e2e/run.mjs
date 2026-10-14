// Browser checks for the brief, best run against the production build:
//   npm run build && npm run preview          (serves http://localhost:4174/aerovia-inspector-demo/)
//   node e2e/run.mjs [--url=…] [--only=load,acts,scroll,anchors,keyboard,form,fallbacks,pause,resize]
// Every check prints PASS or FAIL; the exit code is 1 if anything failed.
import { launchBrowser } from '../scripts/browser.mjs';
import { ACT_STILLS } from '../src/experience/config.ts';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const BASE = arg('url', 'http://localhost:4174/aerovia-inspector-demo/');
const ONLY = arg('only', '').split(',').filter(Boolean);
const REQUIRED = [[1440, 900], [1920, 1080], [390, 844]];
// more shapes for the framing checks: laptop, small laptop, tablet both ways, small and tall phones
const EXTRA = [[1280, 720], [1366, 768], [1024, 768], [768, 1024], [375, 667], [412, 915], [960, 540]];
const STILLS = Object.values(ACT_STILLS);

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { const f = (k) => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); }), n);

/** Counts WebGL draw calls, to tell whether the scene is rendering. Runs before the page's scripts. */
function countDraws() {
  window.__draws = 0;
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!C) continue;
    for (const m of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const f = C.prototype[m];
      if (f) C.prototype[m] = function (...a) { window.__draws++; return f.apply(this, a); };
    }
  }
}

const browser = await launchBrowser();

async function open([w, h], { query = '', reduced = false, wait = true, before } = {}) {
  const page = await browser.newPage();
  const mobile = w < 800;
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const errors = [], failed = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', (r) => { const t = r.failure()?.errorText ?? ''; if (!/ERR_ABORTED/.test(t)) failed.push(`${t} ${r.url()}`); });
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  await page.evaluateOnNewDocument(countDraws);
  if (before) await before(page);
  const t0 = Date.now();
  await page.goto(BASE + query, { waitUntil: 'domcontentloaded' });
  if (wait) await page.waitForFunction(() => document.querySelector('.xp-static') || (document.querySelector('.xp') && !document.querySelector('.load')), { timeout: 90000 });
  return { page, errors, failed, readyMs: Date.now() - t0 };
}

const yFor = (page, p) => page.evaluate((p) => {
  const xp = document.querySelector('.xp');
  return Math.round(xp.getBoundingClientRect().top + scrollY + p * (xp.offsetHeight - innerHeight));
}, p);
async function jump(page, y) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y);
  await frames(page, 4);
  await sleep(60); // the on-screen observer and React may resume the frame loop a frame later
  await frames(page, 2);
}
/** Waits until the page has stopped scrolling (smooth scrolls and wheel animations included). */
async function settle(page) {
  let last = -1, same = 0;
  for (let i = 0; i < 120 && same < 4; i++) {
    const y = await page.evaluate(() => scrollY);
    same = y === last ? same + 1 : 0;
    last = y;
    await sleep(40);
  }
  await frames(page, 4);
  return last;
}
/** Screen positions of the drone, hub and defect pins: a fingerprint of the camera and drone pose. */
const pose = (page) => page.evaluate(() => [...document.querySelectorAll('.pin')].map((el) => {
  const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(el.style.transform);
  return m ? [Number(m[1]), Number(m[2])] : null;
}));
const poseDiff = (a, b) => Math.max(...a.map((p, i) => (p && b[i] ? Math.hypot(p[0] - b[i][0], p[1] - b[i][1]) : p === b[i] ? 0 : Infinity)));

/** Text that overflows a box that clips it, and the page's horizontal overflow. */
const clipping = (page) => page.evaluate(() => {
  const cut = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('.xp-stage, .visually-hidden, .skip-link')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
    if (!/hidden|clip/.test(cs.overflowX + cs.overflowY) || !el.textContent.trim()) continue;
    if (cs.clip !== 'auto' || (el.clientWidth <= 1 && el.clientHeight <= 1)) continue;
    if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) cut.push(`${el.tagName.toLowerCase()}.${el.className}`);
  }
  return { cut, overflowX: document.documentElement.scrollWidth - innerWidth };
});

/** Where the active act's blocks, the skip button, the header and the drone are on screen. */
const actLayout = (page) => page.evaluate(() => {
  const rect = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  const acts = [...document.querySelectorAll('.act')];
  const i = acts.findIndex((a) => a.dataset.active === 'true');
  // the drone's outline on screen (its box, propellers included), written by the scene
  const box = document.querySelector('.pin-drone')?.dataset.box?.split(',').map(Number);
  const labels = [...document.querySelectorAll('.pin')].filter((p) => getComputedStyle(p).visibility === 'visible').map((p) => rect(p.querySelector('.pin-label')));
  return {
    vw: innerWidth, vh: innerHeight, i,
    opacity: i >= 0 ? Number(getComputedStyle(acts[i]).opacity) : 0,
    header: document.querySelector('.site-header').getBoundingClientRect().bottom,
    blocks: i >= 0 ? [...acts[i].children].map(rect) : [],
    skip: rect(document.querySelector('.xp-skip')),
    drone: box ? { l: box[0], t: box[1], r: box[2], b: box[3] } : null,
    labels,
  };
});
const overlaps = (a, b, pad = 0) => a.l < b.r + pad && b.l < a.r + pad && a.t < b.b + pad && b.t < a.b + pad;
const fmt = (b) => [b.l, b.t, b.r, b.b].map(Math.round).join(',');

async function section(name, fn) {
  if (ONLY.length && !ONLY.includes(name)) return;
  console.log(`\n— ${name}`);
  try { await fn(); } catch (e) { check(`${name}: ran without exceptions`, false, String(e?.stack ?? e).split('\n')[0]); }
}

// ------------------------------------------------------------------ load, console, resources, links
await section('load', async () => {
  for (const size of REQUIRED) {
    const tag = size.join('×');
    const { page, errors, failed, readyMs } = await open(size);
    check(`${tag}: 3D scene ready`, await page.$('.xp-canvas canvas') !== null, `${(readyMs / 1000).toFixed(1)} s`);
    // walk the page so lazy images load, then look for problems
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += size[1]) await jump(page, y);
    await settle(page);
    const broken = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src));
    const missing = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')).filter((h) => h.length > 1 && !document.getElementById(h.slice(1))));
    const external = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.href).filter((h) => !h.startsWith(location.origin)));
    const { cut, overflowX } = await clipping(page);
    check(`${tag}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
    check(`${tag}: no missing or failed resources`, failed.length === 0, failed.slice(0, 3).join(' | '));
    check(`${tag}: no broken images`, broken.length === 0, broken.join(' '));
    check(`${tag}: every in-page link has a target`, missing.length === 0, missing.join(' '));
    check(`${tag}: no links leave the site`, external.length === 0, external.join(' '));
    check(`${tag}: no horizontal overflow`, overflowX <= 0, `${overflowX}px`);
    check(`${tag}: no clipped text outside the stage`, cut.length === 0, cut.join(', '));
    if (size[0] < 800) {
      const small = await page.evaluate(() => [...document.querySelectorAll('a[href], button, input, select, textarea')].filter((el) => {
        if (el.closest('.visually-hidden, .skip-link')) return false;
        const cs = getComputedStyle(el), r = el.getBoundingClientRect();
        return cs.visibility !== 'hidden' && cs.display !== 'none' && r.width > 0 && (r.height < 44 || r.width < 44);
      }).map((el) => `${el.tagName.toLowerCase()}.${el.className} ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`));
      check(`${tag}: touch targets at least 44×44 px`, small.length === 0, small.join(', '));
    }
    await page.close();
  }
});

// ------------------------------------------------------------------ framing of the four acts
await section('acts', async () => {
  for (const size of [...REQUIRED, ...EXTRA]) {
    const tag = size.join('×');
    const { page, errors } = await open(size, { query: '?still' });
    if (await page.$('.xp-static')) { check(`${tag}: static version (window too low for the stage)`, true); await page.close(); continue; }
    for (const [k, p] of STILLS.entries()) {
      await jump(page, await yFor(page, p));
      const L = await actLayout(page);
      const name = `${tag} act ${k + 1}`;
      const inside = L.blocks.every((b) => b.l >= -1 && b.r <= L.vw + 1 && b.t >= L.header - 1 && b.b <= L.vh + 1);
      check(`${name}: shown alone and fully opaque`, L.i === k && L.opacity > 0.99, `active ${L.i + 1}, opacity ${L.opacity}`);
      check(`${name}: texts inside the screen, below the header`, inside, JSON.stringify(L.blocks.map((b) => [b.l, b.t, b.r, b.b].map(Math.round))));
      check(`${name}: texts clear of the skip button`, L.blocks.every((b) => !overlaps(b, L.skip, 8)), `skip ${fmt(L.skip)} texts ${L.blocks.map(fmt).join(' ')}`);
      if (k < 3 && L.drone) check(`${name}: no text over the drone`, L.blocks.every((b) => !overlaps(L.drone, b, 8)), `drone ${fmt(L.drone)} texts ${L.blocks.map(fmt).join(' ')}`);
      if (k === 3) check(`${name}: report card and text do not overlap`, L.blocks.length < 2 || !overlaps(L.blocks[0], L.blocks[1]));
      check(`${name}: scene labels inside the screen`, L.labels.every((b) => b.l >= 0 && b.r <= L.vw && b.t >= 0 && b.b <= L.vh), JSON.stringify(L.labels.map((b) => [b.l, b.r].map(Math.round))));
    }
    check(`${tag}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await page.close();
  }
});

// ------------------------------------------------------------------ scroll: slow, fast, reverse, stop
await section('scroll', async () => {
  for (const size of [[1440, 900], [390, 844]]) {
    const tag = size.join('×');
    const { page } = await open(size, { query: '?still' });
    await page.mouse.move(size[0] / 2, size[1] / 2);
    // slow, by wheel, into the inspection act
    const target = await yFor(page, 0.6);
    for (let y = 0; y < target; y += 90) { await page.mouse.wheel({ deltaY: 90 }); await sleep(30); }
    const y1 = await settle(page);
    const a = await pose(page);
    await sleep(700);
    const a2 = await pose(page);
    check(`${tag}: the scene stops when the scroll stops`, poseDiff(a, a2) < 0.5, `moved ${poseDiff(a, a2).toFixed(2)}px in 0.7 s`);
    // fast forward to the end, then fast back, then land on the same position
    for (let i = 0; i < 6; i++) await page.mouse.wheel({ deltaY: 2400 });
    await settle(page);
    for (let i = 0; i < 4; i++) await page.mouse.wheel({ deltaY: -2400 });
    await settle(page);
    await jump(page, y1);
    const b = await pose(page);
    check(`${tag}: same frame after fast scroll back and forth`, poseDiff(a, b) < 0.5, `${poseDiff(a, b).toFixed(2)}px`);
    // slow reverse from the end of the track
    await jump(page, await yFor(page, 1));
    for (let i = 0; i < 30; i++) { await page.mouse.wheel({ deltaY: -90 }); await sleep(30); }
    await settle(page);
    await jump(page, y1);
    const c = await pose(page);
    check(`${tag}: same frame after slow reverse scroll`, poseDiff(a, c) < 0.5, `${poseDiff(a, c).toFixed(2)}px`);
    // every act along the way, both directions
    const fwd = [], back = [];
    for (const p of STILLS) { await jump(page, await yFor(page, p)); fwd.push(await pose(page)); }
    for (const p of [...STILLS].reverse()) { await jump(page, await yFor(page, p)); back.unshift(await pose(page)); }
    const worst = Math.max(...fwd.map((f, i) => poseDiff(f, back[i])));
    check(`${tag}: each act frames the same forwards and backwards`, worst < 0.5, `${worst.toFixed(2)}px`);
    await page.close();
  }
});

// ------------------------------------------------------------------ anchors, skip links, menu
await section('anchors', async () => {
  {
    const { page } = await open([1440, 900]);
    const header = await page.$eval('.site-header', (el) => el.offsetHeight);
    for (const href of ['#servicios', '#proceso', '#informe', '#contacto', '#inspeccion']) {
      await page.click(`.menu a[href="${href}"]`);
      await settle(page);
      const r = await page.evaluate((href) => {
        const el = document.querySelector(href);
        return { top: el.getBoundingClientRect().top, y: scrollY, hash: location.hash, focus: document.activeElement === el, start: el.dataset.top === 'start' };
      }, href);
      const ok = r.start ? r.y === 0 : Math.abs(r.top - header) <= 2;
      check(`menu ${href}: lands below the header and takes focus`, ok && r.hash === href && r.focus, JSON.stringify(r));
    }
    await jump(page, 0);
    await page.click('.act-1 .btn-primary');
    await settle(page);
    check('hero CTA «Solicitar inspección» goes to the form', await page.evaluate(() => location.hash === '#contacto' && Math.abs(document.querySelector('#contacto').getBoundingClientRect().top - document.querySelector('.site-header').offsetHeight) <= 2));
    await jump(page, 0);
    await page.click('.act-1 .btn-ghost');
    await settle(page);
    check('hero CTA «Ver el proceso» goes to the process', await page.evaluate(() => location.hash === '#proceso'));
    await jump(page, 0);
    await page.click('.xp-skip');
    await settle(page);
    check('«Saltar la experiencia» goes past the 3D track', await page.evaluate(() => location.hash === '#servicios' && document.querySelector('#servicios').getBoundingClientRect().top < innerHeight / 2));
    await page.close();
  }
  {
    // the first Tab reaches the skip link, which is visible and skips the experience
    const { page } = await open([1440, 900]);
    await page.keyboard.press('Tab');
    await sleep(300); // it slides in
    const skip = await page.evaluate(() => { const el = document.activeElement; const r = el.getBoundingClientRect(); return { cls: el.className, visible: r.top >= 0 && r.bottom <= innerHeight }; });
    check('first Tab: visible «Saltar al contenido» link', skip.cls.includes('skip-link') && skip.visible, JSON.stringify(skip));
    await page.keyboard.press('Enter');
    await settle(page);
    check('skip link moves focus to the content after the experience', await page.evaluate(() => document.activeElement?.id === 'servicios' && location.hash === '#servicios'));
    await page.close();
  }
  {
    // a hash in the URL on arrival
    // (the 3D stage is off screen, so it waits to draw: nothing to wait for here)
    const { page } = await open([1440, 900], { query: '#informe', wait: false });
    await page.waitForFunction(() => scrollY > 0, { timeout: 30000 });
    await settle(page);
    check('arriving with #informe lands on the report', await page.evaluate(() => Math.abs(document.querySelector('#informe').getBoundingClientRect().top - document.querySelector('.site-header').offsetHeight) <= 2));
    await page.close();
  }
  {
    const { page } = await open([390, 844]);
    const hidden = await page.$eval('#menu', (el) => getComputedStyle(el).visibility);
    check('mobile: closed menu is hidden from the tab order', hidden === 'hidden');
    const order = [];
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => document.activeElement.className || document.activeElement.tagName)); }
    check('mobile: Tab skips the closed menu links', !order.some((c) => c === 'A' || /menu-cta/.test(c)), order.join(' → '));
    await page.click('.menu-toggle');
    await sleep(250);
    check('mobile: menu opens with aria-expanded', await page.$eval('.menu-toggle', (b) => b.getAttribute('aria-expanded') === 'true' && getComputedStyle(document.querySelector('#menu')).visibility === 'visible'));
    await page.keyboard.press('Escape');
    await sleep(250);
    check('mobile: Escape closes the menu and returns focus', await page.evaluate(() => document.querySelector('.menu-toggle').getAttribute('aria-expanded') === 'false' && document.activeElement.classList.contains('menu-toggle')));
    await page.click('.menu-toggle');
    await sleep(250);
    await page.click('#menu a[href="#proceso"]');
    await settle(page);
    check('mobile: a menu link closes the menu and lands on its section', await page.evaluate(() => location.hash === '#proceso' && document.querySelector('.menu-toggle').getAttribute('aria-expanded') === 'false' && Math.abs(document.querySelector('#proceso').getBoundingClientRect().top - document.querySelector('.site-header').offsetHeight) <= 2));
    await page.close();
  }
});

// ------------------------------------------------------------------ keyboard focus
await section('keyboard', async () => {
  for (const size of [[1440, 900], [390, 844]]) {
    const tag = size.join('×');
    const { page } = await open(size);
    const seen = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      await settle(page);
      const f = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el), r = el.getBoundingClientRect();
        const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) || cs.boxShadow !== 'none';
        let o = 1;
        for (let n = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
        const onScreen = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
        return { name: (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 28), ring, onScreen, o: Number(o.toFixed(2)) };
      });
      if (!f) break;
      seen.push(f);
    }
    const bad = seen.filter((f) => !f.ring || !f.onScreen || f.o < 0.95);
    check(`${tag}: each focused control shows a ring and is on screen`, bad.length === 0, bad.map((f) => `${f.name} ring:${f.ring} on:${f.onScreen} o:${f.o}`).join('; ') || `${seen.length} stops`);
    await page.close();
  }
});

// ------------------------------------------------------------------ the demo form never sends
await section('form', async () => {
  const { page } = await open([1440, 900]);
  const before = page.url();
  await page.click('.menu a[href="#contacto"]');
  await settle(page);
  const sent = [];
  page.on('request', (r) => { if (r.method() !== 'GET' || !/\.(js|css|woff2?|webp|png|jpg|svg)(\?|$)/.test(r.url())) sent.push(`${r.method()} ${r.url()}`); });
  await page.click('.form button[type="submit"]');
  await sleep(200);
  const empty = await page.evaluate(() => ({ valid: document.querySelector('.form').checkValidity(), status: document.querySelector('.form-status')?.textContent.trim() }));
  check('empty form is not accepted', !empty.valid && !empty.status, JSON.stringify(empty));
  await page.type('.form [name="nombre"]', 'Prueba');
  await page.type('.form [name="correo"]', 'prueba@ejemplo.test');
  await page.click('.form button[type="submit"]');
  await sleep(400);
  const after = await page.evaluate(() => ({ status: document.querySelector('.form-status')?.textContent.trim() ?? '', focus: document.activeElement?.classList.contains('form-status') }));
  check('a filled form says plainly that nothing was sent', /no se ha enviado/i.test(after.status), after.status);
  check('the notice takes focus so it is announced', after.focus === true);
  check('no request leaves the page on submit', sent.length === 0, sent.join(' | '));
  check('the page does not navigate on submit', page.url() === before || page.url().startsWith(before.split('#')[0]));
  await page.close();
});

// ------------------------------------------------------------------ fallbacks: reduced motion, no WebGL, short window, lost context, failed chunk
await section('fallbacks', async () => {
  const staticOk = async (page, tag, reason) => {
    const s = await page.evaluate(() => ({
      static: !!document.querySelector('.xp-static'), canvas: !!document.querySelector('canvas'),
      note: document.querySelector('.xp-static-note')?.textContent ?? '', h1: !!document.querySelector('#hero-title'),
    }));
    check(`${tag}: static version with the same content`, s.static && !s.canvas && s.h1 && reason.test(s.note), JSON.stringify(s));
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += 700) await jump(page, y);
    await settle(page);
    const imgs = await page.evaluate(() => [...document.querySelectorAll('.still-media img')].map((i) => i.complete && i.naturalWidth > 0));
    check(`${tag}: the four stills load`, imgs.length === 4 && imgs.every(Boolean), JSON.stringify(imgs));
    const { cut, overflowX } = await clipping(page);
    check(`${tag}: no clipped text, no horizontal overflow`, cut.length === 0 && overflowX <= 0, `${cut.join(', ')} ${overflowX}px`);
  };
  for (const size of [[1440, 900], [390, 844]]) {
    const { page, errors } = await open(size, { reduced: true });
    await staticOk(page, `reduced motion ${size.join('×')}`, /movimiento reducido/i);
    check(`reduced motion ${size.join('×')}: no WebGL drawing at all`, await page.evaluate(() => window.__draws === 0));
    check(`reduced motion ${size.join('×')}: no console errors`, errors.length === 0, errors.join(' | '));
    await page.close();
  }
  {
    const { page, errors } = await open([1440, 900], { query: '?nowebgl' });
    await staticOk(page, 'no WebGL', /no puede mostrar la escena 3D/i);
    check('no WebGL: no console errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }
  for (const size of [[720, 450], [844, 390], [960, 480]]) {
    const { page, errors } = await open(size);
    await staticOk(page, `short window ${size.join('×')} (200 % zoom, phone sideways)`, /demasiado baja/i);
    check(`short window ${size.join('×')}: no console errors`, errors.length === 0, errors.join(' | '));
    await page.close();
  }
  {
    const { page, errors } = await open([1440, 900]);
    await page.evaluate(() => document.querySelector('.xp-canvas canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await page.waitForSelector('.xp-static', { timeout: 5000 }).catch(() => null);
    await staticOk(page, 'lost WebGL context', /no ha podido cargarse/i);
    check('lost WebGL context: no uncaught errors', errors.filter((e) => !/context lost/i.test(e)).length === 0, errors.join(' | '));
    await page.close();
  }
  {
    const block = async (page) => {
      await page.setRequestInterception(true);
      page.on('request', (r) => (/Scene[-.]/.test(r.url()) ? r.abort() : r.continue()));
    };
    const { page } = await open([1440, 900], { before: block, wait: false });
    await page.waitForSelector('.xp-static', { timeout: 30000 }).catch(() => null);
    await staticOk(page, '3D code fails to load', /no ha podido cargarse/i);
    await page.close();
  }
});

// ------------------------------------------------------------------ the frame loop pauses
await section('pause', async () => {
  const draws = async (page, ms) => { await page.evaluate(() => { window.__draws = 0; }); await sleep(ms); return page.evaluate(() => window.__draws); };
  {
    const { page } = await open([1440, 900]);
    check('ambient motion draws while the stage is on screen', (await draws(page, 600)) > 0);
    await page.click('.menu a[href="#contacto"]');
    await settle(page);
    await sleep(300);
    check('no drawing once the stage is off screen', (await draws(page, 1000)) === 0);
    await jump(page, 0);
    await sleep(300);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await sleep(300);
    check('no drawing while the tab is hidden', (await draws(page, 1000)) === 0);
    await page.close();
  }
  {
    const { page } = await open([1440, 900], { query: '?still' });
    await sleep(500);
    check('without ambient motion, nothing is drawn while the scroll rests', (await draws(page, 1000)) === 0);
    await page.mouse.move(720, 450);
    await page.mouse.wheel({ deltaY: 300 });
    await sleep(400);
    check('…and it draws again when the scroll moves', (await page.evaluate(() => window.__draws)) > 0);
    await page.close();
  }
});

// ------------------------------------------------------------------ resize keeps the scene right
await section('resize', async () => {
  const { page, errors } = await open([1440, 900], { query: '?still' });
  await jump(page, await yFor(page, ACT_STILLS.inspeccion));
  const a = await pose(page);
  for (const [w, h] of [[390, 844], [1920, 1080], [1024, 768]]) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await sleep(400);
    await jump(page, await yFor(page, ACT_STILLS.inspeccion));
    const L = await actLayout(page);
    const inside = L.blocks.every((b) => b.l >= -1 && b.r <= L.vw + 1 && b.t >= L.header - 1 && b.b <= L.vh + 1);
    check(`resized to ${w}×${h}: act 3 framed, texts inside, drone clear`, L.i === 2 && inside && (!L.drone || L.blocks.every((b) => !overlaps(L.drone, b, 8))));
  }
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await sleep(400);
  await jump(page, await yFor(page, ACT_STILLS.inspeccion));
  const b = await pose(page);
  check('back to 1440×900: the same frame as before resizing', poseDiff(a, b) < 0.5, `${poseDiff(a, b).toFixed(2)}px`);
  check('resizing: no console errors', errors.length === 0, errors.join(' | '));
  await page.close();
});

await browser.close();
console.log(`\n${failures ? `${failures} check(s) failed` : 'all checks passed'}`);
process.exit(failures ? 1 : 0);
