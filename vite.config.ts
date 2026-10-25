import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import { PAGE_FILES, renderPartials } from './src/site/partials.ts';

// GitHub Pages serves the demo under /aerovia-inspector-demo/. BASE_PATH lets another
// host use its own base, and SITE_URL (the public address, once there is one) turns on
// absolute share-preview links and canonical URLs; without it no page claims a public URL.
const base = process.env.BASE_PATH ?? '/aerovia-inspector-demo/';
const siteUrl = process.env.SITE_URL ?? '';

/**
 * One HTML file per page (a folder with an index.html, so every route is a real address
 * that survives a reload); the shared head, header and footer are written into each one
 * from src/site/partials.ts before Vite resolves its assets.
 */
function sitePages(): Plugin {
  let root = process.cwd();
  // the share image carries a content hash, so a new render is never served from a cache
  const og = 'public/og-image.jpg';
  const ogImage = `og-image.jpg?v=${existsSync(og) ? createHash('sha1').update(readFileSync(og)).digest('hex').slice(0, 10) : '0'}`;
  return {
    name: 'aerovia-site-pages',
    configResolved(config) { root = config.root; },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const file = relative(root, ctx.filename).replace(/\\/g, '/');
        return renderPartials(html, { base, siteUrl, file, ogImage });
      },
    },
  };
}

export default defineConfig({
  base,
  appType: 'mpa',
  plugins: [sitePages()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    rollupOptions: { input: Object.fromEntries(PAGE_FILES.map((p) => [p.id, resolve(p.file)])) },
  },
  test: { include: ['tests/**/*.test.ts'], environment: 'node', testTimeout: 120000 },
});
