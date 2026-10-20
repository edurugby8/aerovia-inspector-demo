// A local stand-in for GitHub Pages, for the browser checks: serves the build under the
// site's base the way Pages does. A folder answers with its index.html; a folder asked for
// without its final slash is redirected (301) to it; anything else that does not exist gets
// the site's 404.html with status 404.
//   node e2e/pages-server.mjs [--port=4175] [--dir=dist] [--base=/aerovia-inspector-demo/]
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8',
};
const isFile = (f) => fs.stat(f).then((s) => s.isFile(), () => false);
const isDir = (f) => fs.stat(f).then((s) => s.isDirectory(), () => false);

export function startPagesServer({ dir = 'dist', base = '/aerovia-inspector-demo/', port = 4175 } = {}) {
  const root = path.resolve(dir);
  const send = async (res, status, file, head) => {
    const body = await fs.readFile(file);
    res.writeHead(status, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'Content-Length': body.length, 'Cache-Control': 'no-store' });
    res.end(head ? undefined : body);
  };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const head = req.method === 'HEAD';
    let rel;
    try { rel = decodeURIComponent(url.pathname); } catch { rel = ''; }
    if (!rel.startsWith(base)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; }
    const file = path.join(root, rel.slice(base.length));
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    if (rel.endsWith('/') && (await isFile(path.join(file, 'index.html')))) return send(res, 200, path.join(file, 'index.html'), head);
    if (!rel.endsWith('/') && (await isFile(file))) return send(res, 200, file, head);
    if (!rel.endsWith('/') && (await isDir(file))) { res.writeHead(301, { Location: `${url.pathname}/${url.search}` }); res.end(); return; }
    return send(res, 404, path.join(root, '404.html'), head);
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
  const port = Number(arg('port', '4175')), base = arg('base', process.env.BASE_PATH ?? '/aerovia-inspector-demo/');
  await startPagesServer({ dir: arg('dir', 'dist'), base, port });
  console.log(`http://localhost:${port}${base}`);
}
