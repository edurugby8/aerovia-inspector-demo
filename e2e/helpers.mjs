// Shared steps for the browser scripts.

/** Open the page at a viewport size and wait until the 3D scene has drawn its first frame. */
export async function openExperience(browser, url, w, h, { reduced = false, mobile = w < 800, timeout = 60000 } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const errors = [], failed = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', (r) => { if (!/ERR_ABORTED/.test(r.failure()?.errorText ?? '')) failed.push(`${r.failure()?.errorText} ${r.url()}`); });
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (!reduced) await page.waitForFunction(() => document.querySelector('.xp') && !document.querySelector('.load'), { timeout });
  const readyMs = Date.now() - t0;
  return { page, errors, failed, readyMs };
}

/** Scroll so that the experience sits at progress p, then let two frames render. */
export async function scrollToProgress(page, p, settle = 350) {
  await page.evaluate((p) => {
    const xp = document.querySelector('.xp');
    const top = xp.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + p * (xp.offsetHeight - window.innerHeight));
  }, p);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await new Promise((r) => setTimeout(r, settle));
}
