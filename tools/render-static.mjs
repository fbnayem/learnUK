// Renders the enhanced globe in headless Chromium and saves the static fallback images.
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
const url = process.argv[2] || 'http://localhost:4173/index.html?tier=enhanced&perfguard=0';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 2 });
await page.goto(url);
await page.addStyleTag({ content: `html,body,.hero,main{background:transparent!important} .hero::before,.site-header,.hero-copy,.site-footer,main>section:not(.hero),.skip-link,.mobile-menu,.globe-toggle{display:none!important} .hero-visual{position:fixed!important;left:0;top:0;width:640px!important;height:640px!important;max-width:none!important;margin:0!important} .hero-visual picture{display:none}` });
await page.waitForSelector('.hero-visual.is-live', { timeout: 60000 });
await page.waitForTimeout(4200);
await page.evaluate(() => window.__globe.setPaused(true));
await page.waitForTimeout(300);
const buf = await page.locator('.hero-visual').screenshot({ omitBackground: true });
await browser.close();
mkdirSync('static/img', { recursive: true });
for (const w of [480, 720, 960, 1280]) {
  const img = sharp(buf).resize(w, w);
  await img.clone().avif({ quality: 55, effort: 6 }).toFile(`static/img/globe-${w}.avif`);
  await img.clone().webp({ quality: 78, effort: 6 }).toFile(`static/img/globe-${w}.webp`);
  if (w === 720) await img.clone().png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(`static/img/globe-720.png`);
}
console.log('rendered', buf.length);
