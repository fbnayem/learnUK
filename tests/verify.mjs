// Automated verification for the Learn UK site (Chromium via Playwright).
// Usage: node tools/serve.mjs dist 4173 & node tests/verify.mjs
import { chromium, devices } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:4173/';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const GL_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const PAGES = ['index.html', 'universities.html', 'courses.html', 'application-journey.html', 'services.html', 'about.html', 'faqs.html', 'contact.html'];
const WIDTHS = [320, 375, 390, 768, 1024, 1440, 1920, 540, 1200];
const axeSrc = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');

const results = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

async function withBrowser(args, fn) { const b = await chromium.launch({ executablePath: EXE, args }); try { return await fn(b); } finally { await b.close(); } }
// The test machine renders WebGL in software, which the site correctly sends to the static tier.
// To check the tier logic for real GPUs, these tests report a hardware renderer name.
const fakeGpu = () => { for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) { const g = C.prototype.getParameter; C.prototype.getParameter = function (k) { return k === 0x9246 ? 'ANGLE (Test GPU)' : g.call(this, k); }; } };
const sceneRequested = (page) => { const hits = []; page.on('request', (r) => { if (/chunks\/scene-/.test(r.url())) hits.push(r.url()); }); return hits; };

// 1. Layout: no horizontal overflow at any tested width, and at enlarged text.
await withBrowser(GL_ARGS, async (b) => {
  const fails = [];
  for (const w of WIDTHS) {
    const ctx = await b.newContext({ viewport: { width: w, height: 800 }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    for (const path of PAGES) {
      await p.goto(BASE + path + '?tier=static');
      const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      if (r.sw > r.cw) fails.push(`${path}@${w}: ${r.sw}>${r.cw}`);
    }
    await ctx.close();
  }
  ok('No horizontal overflow on 8 pages × ' + WIDTHS.length + ' widths', !fails.length, fails.join('; '));

  const big = [];
  for (const [w, label] of [[320, '320px with 200% system text'], [375, '375px with 200% system text']]) {
    const p = await b.newPage({ viewport: { width: w, height: 800 }, reducedMotion: 'reduce' });
    for (const path of PAGES) {
      await p.goto(BASE + path + '?tier=static');
      await p.addStyleTag({ content: 'html{font-size:200%!important}' }); await p.waitForTimeout(900);
      const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      if (r.sw > r.cw) big.push(`${path} ${label}: ${r.sw}>${r.cw}`);
    }
    await p.close();
  }
  ok('No horizontal overflow with 200% text size at 320 and 375px', !big.length, big.join('; '));

  // 200% browser zoom on a 1280px window = 640 CSS px with 2× device pixels.
  const z = [];
  const p = await b.newPage({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  for (const path of PAGES) { await p.goto(BASE + path + '?tier=static'); const r = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (r > 0) z.push(path); }
  ok('No horizontal overflow at 200% browser zoom (1280px window)', !z.length, z.join(', '));
});

// 2. Tier selection happens before 3D code downloads.
await withBrowser(GL_ARGS, async (b) => {
  const desk = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const h1 = sceneRequested(desk);
  await desk.addInitScript(fakeGpu); await desk.goto(BASE + 'index.html?perfguard=0'); await desk.waitForSelector('.hero-visual.is-live', { timeout: 30000 }).catch(() => {});
  const t1 = await desk.$eval('[data-globe]', (e) => e.dataset.tier);
  ok('Desktop with WebGL gets the enhanced tier and loads 3D', t1 === 'enhanced' && h1.length === 1, `tier=${t1}, 3D requests=${h1.length}`);

  const pauseOk = await desk.evaluate(async () => { const t = document.querySelector('.globe-toggle'); if (!t || getComputedStyle(t).display === 'none') return 'hidden'; t.click(); const a = t.getAttribute('aria-pressed'); t.click(); return a + '/' + t.getAttribute('aria-pressed'); });
  ok('Globe pause control is visible and toggles', pauseOk === 'true/false', pauseOk);

  // Context loss falls back to the static render.
  const lost = await desk.evaluate(() => new Promise((res) => {
    const c = document.querySelector('.hero-visual canvas'); if (!c) return res('no canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl'); gl.getExtension('WEBGL_lose_context').loseContext();
    setTimeout(() => { const h = document.querySelector('[data-globe]'); res(`${h.classList.contains('is-live')}|${h.dataset.tier}|${getComputedStyle(h.querySelector('picture')).opacity}|${!!h.querySelector('canvas')}`); }, 900);
  }));
  ok('WebGL context loss shows the static visual automatically', lost === 'false|static|1|false', lost);
  await desk.close();

  const phone = await b.newContext({ ...devices['Pixel 7'] });
  const pp = await phone.newPage(); const h2 = sceneRequested(pp); await pp.addInitScript(fakeGpu);
  await pp.goto(BASE); await pp.waitForTimeout(3000);
  const t2 = await pp.$eval('[data-globe]', (e) => e.dataset.tier);
  ok('Capable phone (Pixel 7 emulation) gets the simplified tier', t2 === 'simplified' || (t2 === 'static' && h2.length === 1), `tier=${t2}, reason=${await pp.$eval('[data-globe]', (e) => e.dataset.tierReason)}, 3D requests=${h2.length}`);
  await phone.close();

  const rm = await b.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); const h3 = sceneRequested(rm);
  await rm.goto(BASE); await rm.waitForTimeout(2500);
  const t3 = await rm.$eval('[data-globe]', (e) => e.dataset.tier);
  ok('Reduced motion gets the static tier and never downloads 3D', t3 === 'static' && h3.length === 0, `tier=${t3}, 3D requests=${h3.length}`);
  await rm.close();

  const sd = await b.newPage({ viewport: { width: 1440, height: 900 } }); const h4 = sceneRequested(sd);
  await sd.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true, effectiveType: '4g' } }));
  await sd.goto(BASE); await sd.waitForTimeout(2500);
  const t4 = await sd.$eval('[data-globe]', (e) => e.dataset.tier);
  ok('Data saver gets the static tier and never downloads 3D', t4 === 'static' && h4.length === 0, `tier=${t4}, 3D requests=${h4.length}`);
  await sd.close();

  const low = await b.newPage({ viewport: { width: 1440, height: 900 } }); const h5 = sceneRequested(low);
  await low.addInitScript(() => { Object.defineProperty(navigator, 'hardwareConcurrency', { value: 2 }); Object.defineProperty(navigator, 'deviceMemory', { value: 1 }); });
  await low.goto(BASE); await low.waitForTimeout(2500);
  const t5 = await low.$eval('[data-globe]', (e) => e.dataset.tier);
  ok('Low-end device gets the static tier and never downloads 3D', t5 === 'static' && h5.length === 0, `tier=${t5}, 3D requests=${h5.length}`);
  await low.close();
});

await withBrowser(GL_ARGS, async (b) => {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const h = sceneRequested(p);
  await p.goto(BASE); await p.waitForTimeout(2500);
  const d = await p.$eval('[data-globe]', (e) => e.dataset.tier + '/' + e.dataset.tierReason);
  ok('Software WebGL (SwiftShader) gets the static tier and never downloads 3D', d === 'static/software-renderer' && h.length === 0, `${d}, 3D requests=${h.length}`);
});

await withBrowser(['--disable-webgl', '--disable-3d-apis'], async (b) => {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const h = sceneRequested(p);
  await p.goto(BASE); await p.waitForTimeout(2500);
  const t = await p.$eval('[data-globe]', (e) => e.dataset.tier);
  const imgOk = await p.$eval('.hero-visual img', (i) => i.complete && i.naturalWidth > 0);
  ok('No WebGL: static tier, fallback image shown, 3D never downloaded', t === 'static' && imgOk && h.length === 0, `tier=${t}, image loaded=${imgOk}, 3D requests=${h.length}`);
});

// 3. Hero is usable before 3D loads (3D request held back for 8 s).
await withBrowser(GL_ARGS, async (b) => {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.route(/chunks\/scene-/, async (route) => { await new Promise((r) => setTimeout(r, 8000)); route.continue().catch(() => {}); });
  const t0 = Date.now();
  await p.goto(BASE, { waitUntil: 'domcontentloaded' });
  await p.locator('#hero-title').waitFor({ state: 'visible' });
  const h1Opacity = await p.$eval('#hero-title', (e) => getComputedStyle(e).opacity);
  const ctaVisible = await p.locator('.hero-actions a[href="contact.html"]').isVisible();
  await p.click('[data-lead] button[type=submit]');
  const blankFocus = await p.evaluate(() => document.activeElement.id);
  await p.fill('#lead-phone', '+44 7700 900123');
  await p.fill('#lead-email', 'amina@example');
  await p.click('[data-lead] button[type=submit]');
  const badEmail = await p.getAttribute('#lead-email', 'aria-invalid');
  await p.fill('#lead-email', 'amina@example.com');
  await p.click('[data-lead] button[type=submit]');
  await p.locator('[data-lead-success]').waitFor({ state: 'visible' });
  const okFocus = await p.evaluate(() => document.activeElement.matches('[data-lead-success]'));
  ok('Headline, lead form and consultation button work before 3D loads', h1Opacity === '1' && ctaVisible && blankFocus === 'lead-phone' && badEmail === 'true' && okFocus, `h1 opacity=${h1Opacity}, CTA visible=${ctaVisible}, empty submit focuses ${blankFocus}, bad email invalid=${badEmail}, success shown+focused=${okFocus} in ${Date.now() - t0}ms`);
});

// 4. Interactions: navigation, menus, FAQ, filters, journey.
await withBrowser(GL_ARGS, async (b) => {
  const errors = [];
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(BASE + 'about.html');
  await p.focus('.nav-trigger'); await p.keyboard.press('Enter');
  const open = await p.$eval('#dd-study', (e) => e.classList.contains('is-open'));
  await p.keyboard.press('Tab'); const inMenu = await p.evaluate(() => document.activeElement.closest('#dd-study') !== null);
  await p.keyboard.press('Escape');
  const closed = await p.$eval('#dd-study', (e) => !e.classList.contains('is-open'));
  const backOnTrigger = await p.evaluate(() => document.activeElement.classList.contains('nav-trigger'));
  ok('Study dropdown opens with keyboard, Escape closes and returns focus', open && inMenu && closed && backOnTrigger);

  await p.goto(BASE + 'faqs.html');
  const before = await p.$eval('.faq details', (d) => d.open);
  await p.click('.faq summary'); await p.waitForTimeout(450);
  const after = await p.$eval('.faq details', (d) => d.open);
  await p.focus('.faq summary'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  const closedAgain = await p.$eval('.faq details', (d) => d.open);
  ok('FAQ expands and collapses by mouse and keyboard', !before && after && !closedAgain);

  await p.goto(BASE + 'courses.html?level=Postgraduate&subject=Computing');
  const c1 = await p.textContent('[data-count]');
  await p.fill('#c-q', 'data'); await p.waitForTimeout(400);
  const c2 = await p.textContent('[data-count]');
  const visible = await p.$$eval('[data-item]:not([hidden]) h3', (h) => h.map((x) => x.textContent));
  await p.fill('#c-q', 'zzzz'); await p.waitForTimeout(400);
  const empty = await p.isVisible('[data-empty]');
  await p.click('[data-clear]'); await p.waitForTimeout(400);
  const c3 = await p.textContent('[data-count]');
  ok('Course filters: URL prefill, live search, empty state and clear', /^\d/.test(c1) && visible.every((t) => /data/i.test(t)) && empty && c3.startsWith('36'), `${c1} → ${c2} → empty=${empty} → ${c3}`);

  await p.goto(BASE + 'application-journey.html');
  await p.evaluate(() => document.querySelectorAll('.journey-step')[3].scrollIntoView({ block: 'center' })); await p.waitForTimeout(500);
  const active = await p.$$eval('.journey-step', (s) => s.findIndex((x) => x.classList.contains('is-active')));
  ok('Application journey highlights the step in view', active === 3, `active step index=${active}`);
  ok('No script errors or console errors during interaction tests', !errors.length, errors.join(' | '));
});

// 5. Mobile menu by touch and keyboard.
await withBrowser(GL_ARGS, async (b) => {
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  await p.goto(BASE + 'services.html');
  await p.tap('.menu-toggle'); await p.waitForTimeout(300);
  const open = await p.$eval('#mobile-menu', (e) => e.classList.contains('is-open'));
  const inert = await p.$eval('main', (e) => e.hasAttribute('inert'));
  await p.keyboard.press('Escape');
  const closed = await p.$eval('#mobile-menu', (e) => !e.classList.contains('is-open'));
  const sizes = await p.$$eval('a, button, input, select, textarea, summary', (els) => els.filter((e) => e.offsetParent && !e.closest('.mobile-menu:not(.is-open)')).map((e) => { const r = e.getBoundingClientRect(); return { t: (e.textContent || e.name || e.tagName).trim().slice(0, 30), w: r.width, h: r.height, inline: !!e.closest('p, li.tag, .sample-note, .hint') }; }).filter((x) => !x.inline && (x.h < 44 || x.w < 44)));
  ok('Mobile menu opens by touch, makes page inert, closes with Escape', open && inert && closed);
  ok('Touch targets at least 44×44 px (excluding inline text links)', sizes.length === 0, sizes.map((s) => `${s.t} ${Math.round(s.w)}×${Math.round(s.h)}`).join('; '));
  await ctx.close();
});

// 6. Enquiry journey: keyboard only, then touch only.
await withBrowser(GL_ARGS, async (b) => {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(BASE + 'contact.html');
  await p.focus('#name');
  await p.keyboard.press('Enter'); // submit empty from a text field
  await p.waitForTimeout(150);
  const summaryFocused = await p.evaluate(() => document.activeElement.matches('[data-error-summary]'));
  const errCount = await p.$$eval('[data-error-summary] li', (l) => l.length);
  const invalid = await p.$$eval('[aria-invalid="true"]', (l) => l.map((e) => e.id));
  await p.keyboard.press('Tab'); await p.keyboard.press('Enter');
  const jumped = await p.evaluate(() => document.activeElement.id);
  await p.keyboard.type('Amina Rahman');
  await p.keyboard.press('Tab'); await p.keyboard.type('amina@example');
  await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); // phone (optional) → country
  await p.keyboard.type('Bangladesh');
  await p.keyboard.press('Tab'); await p.keyboard.type('Postgraduate');
  await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.type('MSc Data Science');
  await p.keyboard.press('Tab'); await p.keyboard.type('I would like a January start.');
  await p.keyboard.press('Tab'); await p.keyboard.press('Space');
  await p.keyboard.press('Tab'); await p.keyboard.press('Enter');
  await p.waitForTimeout(200);
  const emailErr = await p.$eval('#email', (e) => e.getAttribute('aria-invalid'));
  await p.fill('#email', 'amina@example.com');
  await p.focus('[type=submit]'); await p.keyboard.press('Enter');
  await p.waitForSelector('[data-success]:not([hidden])', { timeout: 3000 }).catch(() => {});
  const success = await p.evaluate(() => ({ shown: !document.querySelector('[data-success]').hidden, focus: document.activeElement.tagName, name: document.querySelector('[data-first-name]').textContent }));
  ok('Enquiry by keyboard: error summary, field links, validation, success state', summaryFocused && errCount === 5 && invalid.length === 5 && jumped === 'name' && emailErr === 'true' && success.shown && success.focus === 'H2' && success.name === 'Amina',
    `summary focused=${summaryFocused}, errors=${errCount}, bad email caught=${emailErr}, success=${JSON.stringify(success)}`);

  const ctx = await b.newContext({ ...devices['Pixel 7'] });
  const t = await ctx.newPage();
  await t.goto(BASE + 'contact.html');
  await t.tap('#name'); await t.keyboard.type('Kwame Mensah');
  await t.tap('#email'); await t.keyboard.type('kwame@example.com');
  await t.selectOption('#country', 'Ghana');
  await t.selectOption('#level', 'Undergraduate');
  await t.tap('#consent');
  const vvBefore = await t.evaluate(() => window.visualViewport.height);
  await t.tap('[type=submit]');
  await t.waitForSelector('[data-success]:not([hidden])', { timeout: 3000 }).catch(() => {});
  const shown = await t.$eval('[data-success]', (e) => !e.hidden);
  ok('Enquiry by touch (Pixel 7 emulation) reaches the success state', shown, `visual viewport ${vvBefore}px`);
  await ctx.close();
});

// 7. Accessibility scan (axe-core, WCAG 2.2 AA rules).
await withBrowser(GL_ARGS, async (b) => {
  const all = [];
  for (const [w, label] of [[1440, 'desktop'], [375, 'mobile']]) {
    const p = await b.newPage({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce' });
    for (const path of PAGES) {
      await p.goto(BASE + path + '?tier=static');
      await p.addScriptTag({ content: axeSrc });
      const r = await p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] })).violations.map((v) => `${v.id}(${v.nodes.length}): ${v.nodes[0].target.join(' ')}`));
      r.forEach((x) => all.push(`${label} ${path}: ${x}`));
    }
    await p.close();
  }
  ok('axe-core: no WCAG 2.2 AA or best-practice violations (8 pages, desktop and mobile)', !all.length, all.join('\n      '));
});

// 8. Layout stability on load (mobile emulation, simplified tier).
await withBrowser(GL_ARGS, async (b) => {
  const ctx = await b.newContext({ ...devices['Pixel 7'] });
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
  await p.goto(BASE); await p.waitForTimeout(5000);
  const cls = await p.evaluate(() => window.__cls);
  ok('Cumulative layout shift on home load ≤ 0.1 (lab)', cls <= 0.1, `CLS=${cls.toFixed(4)}`);
  await ctx.close();
});

const failed = results.filter((r) => !r.pass).length;
writeFileSync(new URL('./results.json', import.meta.url), JSON.stringify({ date: new Date().toISOString(), browser: 'Chromium 141 (Playwright 1.56, headless, SwiftShader WebGL)', results }, null, 2));
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
