// Minimal static server for local testing: node tools/serve.mjs [dir] [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const dir = process.argv[2] || 'dist', port = +(process.argv[3] || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif' };
createServer(async (req, res) => {
  let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  if (p.endsWith('/')) p += 'index.html';
  const f = join(dir, p);
  try { await stat(f); res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' }); res.end(await readFile(f)); }
  catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, () => console.log(`http://localhost:${port}`));
