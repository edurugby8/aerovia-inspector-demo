// Browser checks for the multi-page site, against the production build served the way GitHub
// Pages serves it (e2e/pages-server.mjs: folders, redirects to the final slash, the 404 page):
//   npm run build && node e2e/run.mjs [--only=pages,history,menu,nojs,player,reduced,layout] [--shots=docs/screenshots]
//   node e2e/run.mjs --url=https://…/aerovia-inspector-demo/      (any other server, e.g. the real one)
// Every check prints PASS or FAIL; the exit code is 1 if anything failed. With --shots it also
// saves a desktop and a phone screenshot of every page.
import fs from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser } from '../scripts/browser.mjs';
import { startPagesServer } from './pages-server.mjs';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const SITE_BASE = process.env.BASE_PATH ?? '/aerovia-inspector-demo/';
const server = arg('url', '') ? null : await startPagesServer({ base: SITE_BASE, port: 4175 });
const BASE = arg('url', `http://localhost:4175${SITE_BASE}`);
const BASE_PATH = new URL(BASE).pathname;
const ONLY = arg('only', '').split(',').filter(Boolean);
const SHOTS = arg('shots', '');
const run = (name) => !ONLY.length || ONLY.includes(name);
const PAGES = [
  { path: '', h1: 'Inspección aérea. Criterio de ingeniería.', label: 'Inicio', shot: 'inicio' },
  { path: 'servicios/', h1: 'Inspección visual con drones para activos en altura', label: 'Servicios', shot: 'servicios' },
  { path: 'inspeccion-eolica/', h1: 'Así se inspecciona una pala', label: 'Inspección eólica', shot: 'inspeccion-eolica' },
  { path: 'como-trabajamos/', h1: 'Cuatro fases, un mismo orden', label: 'Cómo trabajamos', shot: 'como-trabajamos' },
  { path: 'informes/', h1: 'Un informe ordenado para su equipo de ingeniería', label: 'Informes', shot: 'informes' },
  { path: 'contacto/', h1: 'Solicitar presupuesto', label: 'Contacto', shot: 'contacto' },
];
const DESKTOP = [1440, 900], PHONE = [390, 844];
const SIZES = [[1920, 1080], [1440, 900], [1280, 720], [1024, 768], [768, 1024], [412, 915], [390, 844], [360, 740]];

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { const f = (k) => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); }), n);

const browser = await launchBrowser();

async function open(url, [w, h] = DESKTOP, { reduced = false, js = true } = {}) {
  const page = await browser.newPage();
  const mobile = w < 800;
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  if (!js) await page.setJavaScriptEnabled(false);
  const errors = [], failed = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', (r) => { const t = r.failure()?.errorText ?? ''; if (!/ERR_ABORTED/.test(t)) failed.push(`${t} ${r.url()}`); });
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) failed.push(`${r.status()} ${r.url()}`); });
  const response = await page.goto(url, { waitUntil: 'networkidle0' });
  return { page, errors, failed, status: response?.status() };
}
const state = (page) => page.evaluate(() => ({
  path: location.pathname,
  h1: document.querySelector('h1')?.textContent.trim(),
  current: [...document.querySelectorAll('.nav [aria-current="page"]')].map((a) => a.textContent.trim()),
  brokenImages: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src),
  overflow: document.documentElement.scrollWidth - innerWidth,
}));

// ------------------------------------------------------------------ every page, opened directly and reloaded
if (run('pages')) {
  for (const p of PAGES) {
    for (const size of [DESKTOP, PHONE]) {
      const { page, errors, failed, status } = await open(BASE + p.path, size);
      // load every lazy picture before counting broken ones
      await page.evaluate(async () => { for (const i of document.images) i.loading = 'eager'; await Promise.all([...document.images].map((i) => i.decode().catch(() => null))); });
      let s = await state(page);
      const tag = `${p.label} ${size.join('×')}`;
      check(`${tag}: opens directly`, (status === 200 || status === 304) && s.h1 === p.h1, `${status} ${s.h1}`);
      check(`${tag}: menu marks it as the current page`, size === PHONE || JSON.stringify(s.current) === JSON.stringify([p.label]), s.current.join(','));
      check(`${tag}: every picture loads`, s.brokenImages.length === 0, s.brokenImages.join(' '));
      check(`${tag}: no horizontal scroll`, s.overflow <= 0, `${s.overflow}px`);
      check(`${tag}: no errors or failed requests`, !errors.length && !failed.length, [...errors, ...failed].join(' | '));
      if (size === DESKTOP) {
        await page.reload({ waitUntil: 'networkidle0' });
        s = await state(page);
        check(`${tag}: survives a reload`, s.h1 === p.h1 && s.path === BASE_PATH + p.path, s.path);
      }
      // every address in the page lives under the site's base (assets, links, icons)
      const outside = await page.evaluate((base) => [...document.querySelectorAll('[src],[href],[srcset]')]
        .flatMap((e) => [e.getAttribute('src'), e.getAttribute('href'), ...(e.getAttribute('srcset') ?? '').split(',').map((s) => s.trim().split(' ')[0])])
        .filter((u) => u && !u.startsWith('#') && !u.startsWith('data:') && !u.startsWith('mailto:') && !u.startsWith('tel:'))
        .map((u) => new URL(u, location.href).pathname).filter((u) => !u.startsWith(base)), BASE_PATH);
      check(`${tag}: every address is under ${BASE_PATH}`, !outside.length, outside.join(' '));
      if (SHOTS) {
        await fs.mkdir(SHOTS, { recursive: true });
        const file = path.join(SHOTS, `${p.shot}-${size === DESKTOP ? 'escritorio' : 'movil'}.webp`);
        await page.evaluate(() => scrollTo(0, 0));
        await sleep(300);
        await page.screenshot({ path: file, type: 'webp', quality: 82, fullPage: true });
      }
      await page.close();
    }
  }
  // an address that does not exist: the 404 page, with its styles and pictures, at any depth
  for (const missing of ['no-existe/', 'servicios/no-existe/otra']) {
    const { page, failed, status } = await open(BASE + missing);
    const four = await page.evaluate(() => ({ h1: document.querySelector('h1')?.textContent.trim(), styled: getComputedStyle(document.body).backgroundColor }));
    check(`unknown address ${missing}: 404 page with the site look`, status === 404 && four.h1 === 'Página no encontrada' && four.styled === 'rgb(7, 19, 33)', `${status} ${four.h1} ${four.styled}`);
    check(`unknown address ${missing}: its assets load`, failed.filter((f) => !f.includes('no-existe')).length === 0, failed.join(' | '));
    await page.close();
  }
  // a page asked for without its final slash, as people type or paste it
  {
    const { page, status } = await open(BASE + 'informes');
    const s = await state(page);
    check('address without the final slash: lands on the page', status === 200 && s.path === BASE_PATH + 'informes/' && s.h1 === PAGES[4].h1, `${status} ${s.path}`);
    await page.close();
  }
}

// ------------------------------------------------------------------ menu, back and forward
if (run('history')) {
  const { page, errors } = await open(BASE);
  const go = async (label) => { await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.evaluate((l) => [...document.querySelectorAll('.nav a')].find((a) => a.textContent.trim() === l).click(), label)]); return state(page); };
  const visited = [];
  for (const p of [PAGES[1], PAGES[2], PAGES[4], PAGES[5]]) { const s = await go(p.label); visited.push(s.path); check(`menu → ${p.label}`, s.path === BASE_PATH + p.path && s.h1 === p.h1, s.path); }
  for (const p of [PAGES[4], PAGES[2], PAGES[1], PAGES[0]]) {
    await page.goBack({ waitUntil: 'networkidle0' });
    const s = await state(page);
    check(`back → ${p.label}`, s.path === BASE_PATH + p.path && s.h1 === p.h1, s.path);
  }
  for (const p of [PAGES[1], PAGES[2]]) {
    await page.goForward({ waitUntil: 'networkidle0' });
    const s = await state(page);
    check(`forward → ${p.label}`, s.path === BASE_PATH + p.path && s.h1 === p.h1, s.path);
  }
  check('history: no errors', !errors.length, errors.join(' | '));
  await page.close();
}

// ------------------------------------------------------------------ the narrow-screen menu, with and without JavaScript
if (run('menu') || run('nojs')) {
  for (const js of [true, false]) {
    const { page } = await open(BASE + 'servicios/', PHONE, { js });
    const tag = js ? 'phone menu' : 'phone menu without JavaScript';
    const closed = await page.evaluate(() => getComputedStyle(document.querySelector('.nav-mobile__panel')).display === 'none' || !document.querySelector('.nav-mobile').open);
    await page.click('.nav-mobile summary');
    await sleep(200);
    const links = await page.evaluate(() => [...document.querySelectorAll('.nav-mobile__panel li a')].filter((a) => a.getBoundingClientRect().height > 0).map((a) => a.textContent.trim()));
    check(`${tag}: opens and lists the six pages`, closed && links.length === 6, links.join(','));
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.evaluate(() => [...document.querySelectorAll('.nav-mobile__panel li a')].find((a) => a.textContent.trim() === 'Informes').click())]);
    const s = await state(page);
    check(`${tag}: opens a page`, s.path === BASE_PATH + 'informes/', s.path);
    if (js) {
      await page.click('.nav-mobile summary');
      await page.keyboard.press('Escape');
      check(`${tag}: closes with Escape`, await page.evaluate(() => !document.querySelector('.nav-mobile').open));
    }
    await page.close();
  }
  const { page } = await open(BASE + 'inspeccion-eolica/', DESKTOP, { js: false });
  const shown = await page.evaluate(() => [...document.querySelectorAll('.moment__media img')].filter((i) => i.getBoundingClientRect().height > 100).length);
  check('inspection without JavaScript: every moment shows its picture', shown === 4, `${shown}`);
  await page.close();
}

// ------------------------------------------------------------------ the inspection player: forwards and backwards
if (run('player')) {
  for (const size of [DESKTOP, PHONE, [1024, 768]]) {
    const { page, errors } = await open(BASE + 'inspeccion-eolica/', size);
    const tag = `player ${size.join('×')}`;
    check(`${tag}: active`, await page.evaluate(() => document.querySelector('[data-player]').classList.contains('is-player')));
    // scroll so that each moment's middle reaches the reading line, then read which frame shows
    // the frame on top that is fully shown, and really on screen: laid out, its picture decoded
    const visibleFrame = () => page.evaluate(() => {
      const frames = [...document.querySelectorAll('.player-stage__frame')];
      let top = -1;
      frames.forEach((f, i) => {
        const r = f.getBoundingClientRect(), img = f.querySelector('img'), st = getComputedStyle(f);
        const shown = st.display !== 'none' && st.visibility !== 'hidden' && +st.opacity > 0.98 && r.height > 120 && r.bottom > 0 && r.top < innerHeight && img.naturalWidth > 0;
        if (shown) top = i;
      });
      return top;
    });
    const at = async (i) => {
      await page.evaluate((i) => {
        const m = document.querySelectorAll('.moment')[i], s = document.querySelector('.player-stage').getBoundingClientRect();
        const stacked = s.width > document.querySelector('.player-layout').getBoundingClientRect().width * 0.8;
        const line = stacked ? (s.height + innerHeight + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 0)) / 2 : innerHeight / 2;
        const r = m.getBoundingClientRect();
        scrollTo(0, scrollY + r.top + r.height * 0.5 - line);
      }, i);
      await frames(page, 4);
      return visibleFrame();
    };
    const fwd = [], back = [];
    for (let i = 0; i < 4; i++) fwd.push(await at(i));
    for (let i = 3; i >= 0; i--) back.push(await at(i));
    check(`${tag}: frames follow the moments forwards`, fwd.join() === '0,1,2,3', fwd.join());
    check(`${tag}: and backwards`, back.join() === '3,2,1,0', back.join());
    // the texts never sit over the pictures
    const overlaps = [];
    for (let i = 0; i < 4; i++) {
      await at(i);
      const o = await page.evaluate((i) => {
        const t = document.querySelectorAll('.moment__text')[i].getBoundingClientRect(), s = document.querySelector('.player-stage').getBoundingClientRect();
        return Math.max(0, Math.min(t.right, s.right) - Math.max(t.left, s.left)) * Math.max(0, Math.min(t.bottom, s.bottom) - Math.max(t.top, s.top));
      }, i);
      if (o > 0) overlaps.push(`${i}: ${Math.round(o)}px²`);
    }
    check(`${tag}: the text being read is clear of the picture`, !overlaps.length, overlaps.join(' '));
    // what a reader sees at each moment (the full-page capture cannot show a sticky stage)
    if (SHOTS && (size === DESKTOP || size === PHONE)) {
      await fs.mkdir(SHOTS, { recursive: true });
      for (let i = 0; i < 4; i++) {
        await at(i);
        await sleep(400);
        await page.screenshot({ path: path.join(SHOTS, `inspeccion-momento-${i + 1}-${size === DESKTOP ? 'escritorio' : 'movil'}.webp`), type: 'webp', quality: 82 });
      }
    }
    check(`${tag}: no errors`, !errors.length, errors.join(' | '));
    await page.close();
  }
}

// ------------------------------------------------------------------ reduced motion: a still page
if (run('reduced')) {
  const { page } = await open(BASE + 'inspeccion-eolica/', DESKTOP, { reduced: true });
  const r = await page.evaluate(() => ({
    player: document.querySelector('[data-player]').classList.contains('is-player'),
    pictures: [...document.querySelectorAll('.moment__media img')].filter((i) => i.getBoundingClientRect().height > 100).length,
  }));
  check('reduced motion: no scroll player, every moment shows its picture', !r.player && r.pictures === 4, JSON.stringify(r));
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  check('reduced motion: the cover does not drift', await page.evaluate(() => getComputedStyle(document.querySelector('.hero picture img')).animationName === 'none' || parseFloat(getComputedStyle(document.querySelector('.hero picture img')).animationDuration) < 0.1));
  await page.close();
}

// ------------------------------------------------------------------ the cover: the words never sit on the drone
if (run('layout')) {
  const { drone } = JSON.parse(await fs.readFile('docs/rediseno-web/render/inicio-escritorio.json', 'utf8')).overlay;
  const { drone: droneTall } = JSON.parse(await fs.readFile('docs/rediseno-web/render/inicio-movil.json', 'utf8')).overlay;
  for (const size of SIZES) {
    const { page } = await open(BASE, size);
    const r = await page.evaluate((drone, droneTall) => {
      const img = document.querySelector('.hero picture img'), box = img.getBoundingClientRect();
      const tall = innerWidth <= 760, [u, v] = tall ? droneTall : drone;
      // where object-fit: cover with the CSS object-position puts that point of the picture
      const [px, py] = getComputedStyle(img).objectPosition.split(' ').map((s) => parseFloat(s) / 100);
      const k = Math.max(box.width / img.naturalWidth, box.height / img.naturalHeight), w = img.naturalWidth * k, h = img.naturalHeight * k;
      const x = box.left + (box.width - w) * px + u * w, y = box.top + (box.height - h) * py + v * h;
      const c = document.querySelector('.hero-copy').getBoundingClientRect(), hd = document.querySelector('.site-header__inner').getBoundingClientRect();
      const inside = (b, m) => x > b.left - m && x < b.right + m && y > b.top - m && y < b.bottom + m;
      return { x: Math.round(x), y: Math.round(y), copy: inside(c, 40), header: inside(hd, 0), onScreen: x > 0 && x < innerWidth && y > 0 && y < innerHeight };
    }, drone, droneTall);
    check(`cover ${size.join('×')}: the drone is in view and clear of the words`, r.onScreen && !r.copy && !r.header, JSON.stringify(r));
    await page.close();
  }
}

await browser.close();
server?.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
