// Copies the built Learn UK assets from the static site into the plugin and
// patches the few relative paths that would break when served from the plugin folder.
// Usage: node tools/sync-assets.mjs [distDir] [pluginDir]
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(process.argv[2] || join(here, '..', '..', 'dist'));
const plugin = resolve(process.argv[3] || join(here, '..', 'learn-uk-site'));
const out = join(plugin, 'assets');

for (const dir of ['css/site.css', 'fonts', 'img', 'js/main.js', 'js/chunks']) {
  const target = join(out, dir);
  if (existsSync(target)) rmSync(target, { recursive: true });
  cpSync(join(dist, 'assets', dir), target, { recursive: true });
}
mkdirSync(join(out, 'data'), { recursive: true });
for (const f of ['courses.json', 'universities.json']) cpSync(join(dist, 'data', f), join(out, 'data', f));

const compat = join(out, 'css', 'elementor-compat.css');
if (!existsSync(compat)) writeFileSync(compat, '');

// site.css: url(../fonts/...) resolves the same inside assets/, so it is left alone.
// main.js: patch the page-relative course data URL and the internal contact link.
const mainFile = join(out, 'js', 'main.js');
let js = readFileSync(mainFile, 'utf8');
// Fail loudly if a new build adds page links this script does not know about.
const links = js.match(/[\w-]+\.html\b/g) || [];
if (links.join() !== 'contact.html') throw new Error(`main.js page links changed: ${links.join(', ')}`);
const patches = [
  // Course data is fetched from the plugin's assets/data/ folder (window.LU.assets ends in "/").
  ['new URL("data/courses.json",document.baseURI)', 'new URL("data/courses.json",window.LU&&LU.assets||document.baseURI)'],
  // Course "Enquire" buttons link to the WordPress contact page.
  ['href="contact.html?${', 'href="${window.LU?LU.home+"contact/":"contact.html"}?${'],
];
for (const [from, to] of patches) {
  const n = js.split(from).length - 1;
  if (n !== 1) throw new Error(`main.js: expected 1 match for ${from}, found ${n}`);
  js = js.replace(from, () => to);
}
writeFileSync(mainFile, js);
console.log(`Assets copied to ${out}`);
