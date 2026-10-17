// node styles.mjs <page> [width]: computed-style differences of matching elements (by order of tag+text)
import { chromium } from 'playwright-core';
const [page, w = '1440'] = process.argv.slice(2);
const urls = [`http://localhost:4173/${page}.html`, `http://localhost:8080/${page === 'index' ? '' : page + '/'}`];
const PROPS = ['font-size', 'font-weight', 'letter-spacing', 'line-height', 'color', 'text-decoration-line', 'text-decoration-thickness', 'text-underline-offset', 'font-family', 'margin-top', 'margin-bottom', 'padding-top', 'background-color', 'border-top-width', 'border-radius', 'text-transform', 'outline-style', 'box-shadow', 'opacity', 'display'];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const res = [];
for (const u of urls) {
  const p = await b.newPage({ viewport: { width: +w, height: 900 }, reducedMotion: 'reduce' });
  await p.goto(u, { waitUntil: 'networkidle' });
  res.push(await p.evaluate((PROPS) => [...document.querySelectorAll('header *, main *, footer *')].filter((e) => !e.closest('svg') && !/^(DIV|SECTION|PICTURE|SOURCE)$/.test(e.tagName) || e.matches('.btn, .card, .feature, .panel, .stat')).map((e) => { const cs = getComputedStyle(e); return { k: e.tagName + ' ' + (e.textContent || e.alt || '').trim().replace(/\s+/g, ' ').slice(0, 30), s: Object.fromEntries(PROPS.map((p) => [p, cs.getPropertyValue(p)])) }; }), PROPS));
  await p.close();
}
await b.close();
const wp = new Map(); for (const e of res[1]) { if (!wp.has(e.k)) wp.set(e.k, []); wp.get(e.k).push(e); }
const diffs = new Map();
for (const e of res[0]) { const q = wp.get(e.k)?.shift(); if (!q) { diffs.set('MISSING in wp: ' + e.k, 1); continue; }
  for (const p of PROPS) if (e.s[p] !== q.s[p]) { const key = `${p}: ${e.s[p]} -> ${q.s[p]}`; if (!diffs.has(key)) diffs.set(key, []); if (diffs.get(key).length < 3) diffs.get(key).push(e.k); } }
for (const [k, v] of diffs) console.log(k, Array.isArray(v) ? '  e.g. ' + v.join(' | ') : '');
