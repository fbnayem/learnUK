// Turns the source photos in assets-src/photos into responsive AVIF/WebP/JPEG files in static/img/photos.
// Usage: node tools/gen-photos.mjs [name ...]   (no names = every photo)
import sharp from 'sharp';
import { readdirSync, mkdirSync } from 'node:fs';

const SRC = 'assets-src/photos', OUT = 'static/img/photos', WIDTHS = [480, 800, 1200, 1536];
mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);
// Card photos are shown small, so they stop at 1200px wide.
const maxW = (name) => (/^(why|service|uni)-/.test(name) ? 1200 : Infinity);
for (const file of readdirSync(SRC).filter((f) => f.endsWith('.jpg'))) {
  const name = file.replace(/\.jpg$/, '');
  if (only.length && !only.includes(name)) continue;
  const meta = await sharp(`${SRC}/${file}`).metadata();
  for (const w of WIDTHS.filter((w) => w <= meta.width && w <= maxW(name))) {
    const img = sharp(`${SRC}/${file}`).resize({ width: w });
    await img.clone().avif({ quality: 50, effort: 6 }).toFile(`${OUT}/${name}-${w}.avif`);
    await img.clone().webp({ quality: 74, effort: 6 }).toFile(`${OUT}/${name}-${w}.webp`);
    if (w === 800) await img.clone().jpeg({ quality: 78, mozjpeg: true, progressive: true }).toFile(`${OUT}/${name}-${w}.jpg`);
  }
  console.log(name, meta.width, meta.height);
}
