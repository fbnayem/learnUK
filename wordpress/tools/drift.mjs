// node drift.mjs <page> <width>: first elements whose position/size differs between static and WordPress
import { chromium } from 'playwright-core';
const [page, w = '1440'] = process.argv.slice(2);
const urls = [`http://localhost:4173/${page}.html`, `http://localhost:8080/${page === 'index' ? '' : page + '/'}`];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const res = [];
for (const u of urls) {
  const p = await b.newPage({ viewport: { width: +w, height: 900 }, reducedMotion: 'reduce' });
  await p.goto(u, { waitUntil: 'networkidle' });
  res.push(await p.evaluate(() => [...document.querySelectorAll('main h1,main h2,main h3,main h4,main p,main li,main img,main a.btn,main dt,main dd,footer h2')].filter((e) => e.getClientRects().length).map((e) => { const r = e.getBoundingClientRect(); return { t: e.tagName + ' ' + (e.textContent || e.alt || '').trim().slice(0, 40), x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) }; })));
  await p.close();
}
await b.close();
const [a, c] = res; let shown = 0, lastDy = 0;
if (a.length !== c.length) console.log(`count static=${a.length} wp=${c.length}`);
for (let i = 0; i < Math.min(a.length, c.length) && shown < 8; i++) {
  const s = a[i], q = c[i]; const dy = q.y - s.y;
  if (s.t !== q.t) { console.log(`#${i} MISMATCH static="${s.t}" wp="${q.t}"`); shown++; continue; }
  if (Math.abs(q.x - s.x) > 3 || Math.abs(q.w - s.w) > 3 || Math.abs(q.h - s.h) > 3 || Math.abs(dy - lastDy) > 3) { console.log(`#${i} ${s.t} | static ${s.x},${s.y} ${s.w}x${s.h} | wp ${q.x},${q.y} ${q.w}x${q.h} (dy ${dy})`); shown++; lastDy = dy; }
}
if (!shown) console.log('no drift');
