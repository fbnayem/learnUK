// node shot.mjs <url> <out.png> [width]
import { chromium } from 'playwright-core';
const [url, out, w = '1440'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' + (process.env.CH || ''), args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: +w, height: 900 }, reducedMotion: 'reduce' });
const errs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
p.on('requestfailed', (r) => errs.push('failed: ' + r.url()));
p.on('response', (r) => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
await p.goto(url, { waitUntil: 'networkidle' });
await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); });
await p.waitForTimeout(600);
await p.screenshot({ path: out, fullPage: true });
console.log(JSON.stringify({ height: await p.evaluate(() => document.body.scrollHeight), errs: errs.slice(0, 15) }));
await b.close();
