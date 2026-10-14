import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the demo under /aerovia-inspector-demo/. BASE_PATH lets another
// host use its own base, and SITE_URL (the public address, once there is one) turns on
// absolute share-preview links; without it the page does not claim any public URL.
const base = process.env.BASE_PATH ?? '/aerovia-inspector-demo/';
const siteUrl = process.env.SITE_URL ?? '';

/** Share-preview tags; the image carries a content hash so a new render is never served from cache. */
function shareMeta(): Plugin {
  return {
    name: 'aerovia-share-meta',
    transformIndexHtml(html) {
      const file = 'public/og-image.jpg';
      const v = existsSync(file) ? createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 10) : '0';
      const image = `${siteUrl || base}og-image.jpg?v=${v}`;
      const tags = [
        `<meta property="og:image" content="${image}" />`,
        '<meta property="og:image:width" content="1200" />',
        '<meta property="og:image:height" content="630" />',
        '<meta property="og:image:alt" content="Dron industrial inspeccionando la pala de un aerogenerador detenido, al atardecer" />',
        `<meta name="twitter:image" content="${image}" />`,
        ...(siteUrl ? [`<meta property="og:url" content="${siteUrl}" />`, `<link rel="canonical" href="${siteUrl}" />`] : []),
      ];
      return html.replace('<!--share-meta-->', tags.join('\n    '));
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), shareMeta()],
  build: { target: 'es2022', assetsInlineLimit: 0, chunkSizeWarningLimit: 1200 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node', testTimeout: 120000 },
});
