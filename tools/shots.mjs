import { chromium } from 'playwright-core';
const [,, path = 'index.html', w = '1440', h = '900', out = 'shot', full = '1', extra = ''] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const mobile = +w < 768;
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile });
await p.goto('http://localhost:4173/' + path);
await p.waitForTimeout(2500);
if (extra === 'scroll') { for (let y = 0; y < 14000; y += 500) { await p.evaluate(() => scrollBy(0, 500)); await p.waitForTimeout(250); } await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(400); }
console.log('in', await p.evaluate(() => document.querySelectorAll('.reveal.is-in').length + '/' + document.querySelectorAll('.reveal').length + ' y=' + scrollY));
await p.screenshot({ path: `/tmp/claude-0/shots/${out}.png`, fullPage: full === '1' });
console.log(await p.evaluate(() => ({ tier: document.querySelector('[data-globe]')?.dataset.tier, reason: document.querySelector('[data-globe]')?.dataset.tierReason, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })));
await b.close();
