// A local Chromium-based browser for the scripts and the browser tests (puppeteer-core
// does not download one). Set BROWSER to override; CI uses the runner's Chrome.
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CANDIDATES = [
  process.env.BROWSER,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

export function browserPath() {
  const found = CANDIDATES.find((p) => p && existsSync(p));
  if (!found) throw new Error('No Chrome/Edge found: set BROWSER=/path/to/browser');
  return found;
}

/** Headless browser with the GPU enabled where available (WebGL scenes need it to be fast). */
export function launchBrowser(extraArgs = []) {
  return puppeteer.launch({
    executablePath: browserPath(),
    headless: 'new',
    // long path-traced renders keep one wait open for many minutes
    protocolTimeout: 40 * 60 * 1000,
    args: ['--hide-scrollbars', '--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=default', ...extraArgs],
  });
}
