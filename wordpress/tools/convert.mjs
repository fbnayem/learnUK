// Converts the built Learn UK pages (dist/*.html) into an Elementor Kit.
// Usage: node convert.mjs <dist dir> <out dir> <image base url>
//   image base url: where Elementor downloads the photos from during import, e.g. https://learn-uk-one.vercel.app/
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from 'node-html-parser';

const [DIST, OUT, IMG_BASE] = process.argv.slice(2).map((p, i) => (i < 2 ? p.replace(/\/?$/, '/') : p.replace(/\/?$/, '/')));
const HOME = 'https://lu.home/';
const ASSETS = 'https://lu.assets/';

// Page file -> WordPress page title. Titles set the slugs, which must match the links (about.html -> /about/).
const PAGES = [
  ['index.html', 'Home'], ['universities.html', 'Universities'], ['courses.html', 'Courses'],
  ['application-journey.html', 'Application journey'], ['services.html', 'Services'], ['about.html', 'About'],
  ['faqs.html', 'FAQs'], ['contact.html', 'Contact'], ['privacy.html', 'Privacy'], ['terms.html', 'Terms'],
  ['cookies.html', 'Cookies'], ['accessibility.html', 'Accessibility'], ['complaints.html', 'Complaints'],
];
const slugOf = (file) => (file === 'index.html' ? 'home' : file.replace(/\.html$/, ''));

/* ---------- URLs ---------- */
function mapUrl(u) {
  if (!u || /^(https?:|mailto:|tel:|#|data:|\/\/)/i.test(u)) return u;
  let m;
  if ((m = u.match(/^assets\/(.*)$/))) return ASSETS + m[1];
  if ((m = u.match(/^data\/(.*)$/))) return ASSETS + 'data/' + m[1];
  if ((m = u.match(/^([a-z0-9-]+)\.html([?#].*)?$/i))) return (m[1] === 'index' ? HOME : HOME + m[1] + '/') + (m[2] || '');
  throw new Error('Unmapped URL: ' + u);
}
const mapSrcset = (s) => s.split(',').map((part) => { const [u, ...rest] = part.trim().split(/\s+/); return [mapUrl(u), ...rest].join(' '); }).join(', ');
function rewriteUrls(root) {
  for (const el of root.querySelectorAll('*')) {
    for (const a of ['href', 'src', 'action', 'poster']) if (el.hasAttribute(a)) el.setAttribute(a, mapUrl(el.getAttribute(a)));
    for (const a of ['srcset', 'imagesrcset']) if (el.hasAttribute(a)) el.setAttribute(a, mapSrcset(el.getAttribute(a)));
    if (el.hasAttribute('style') && /url\(/.test(el.getAttribute('style'))) throw new Error('style url() not handled');
  }
}

/* ---------- Elementor elements ---------- */
let idSeed = '';
let idCount = 0;
const newId = () => createHash('md5').update(idSeed + ':' + idCount++).digest('hex').slice(0, 8);
const widget = (widgetType, settings) => ({ id: newId(), elType: 'widget', isInner: false, widgetType, settings, elements: [] });
const container = (settings, elements, isInner) => ({ id: newId(), elType: 'container', isInner, settings: { content_width: 'full', ...settings }, elements });

const CONTAINER_TAGS = new Set(['div', 'section', 'article', 'header', 'footer', 'aside', 'nav', 'main', 'a']);
const RICH_TOP = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote', 'address']);
const RICH_INNER = new Set([...RICH_TOP, 'a', 'strong', 'em', 'b', 'i', 'br', 'span', 'small', 'abbr', 'time', 'sup', 'sub', 'code', 'li', 'cite', 'q', 'mark', 's']);
const RICH_ATTRS = /^(class|id|href|target|rel|lang|title|datetime|style|aria-[a-z-]+)$/;
const COMPLEX = 'form,input,button,select,textarea,details,script,canvas,template,iframe,video,svg,picture,img,dl,table';

const INLINE_STYLES = new Map();
const tag = (el) => (el.rawTagName || '').toLowerCase();
const isEl = (n) => n.nodeType === 1;
const hasText = (el) => el.childNodes.some((n) => n.nodeType === 3 && n.rawText.trim());
const attrs = (el) => Object.entries(el.attributes);

function isRich(el) {
  if (!RICH_TOP.has(tag(el))) return false;
  const all = [el, ...el.querySelectorAll('*')];
  return all.every((x) => RICH_INNER.has(tag(x)) && attrs(x).every(([k, v]) => RICH_ATTRS.test(k) && !(k === 'style' && /--i:/.test(v))));
}
const isPhoto = (el) => tag(el) === 'picture' && el.querySelector('img') && /\/img\/photos\//.test(el.querySelector('img').getAttribute('src'));

// Attributes a container can't hold become classes the plugin turns back into attributes.
function encodeAttrs(el) {
  const classes = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
  let id = '';
  for (const [k, v] of attrs(el)) {
    if (k === 'class') continue;
    if (k === 'id') { id = v; continue; }
    if (k === 'href' && tag(el) === 'a') continue;
    if (k === 'style') {
      const m = v.trim().match(/^--i:\s*(\d+);?$/);
      if (m) { classes.push('lu-i' + m[1]); continue; }
      // Other inline styles move to a generated class (written to inline-styles.css).
      const decl = v.trim().replace(/;?$/, '');
      const cls = 'lu-s-' + createHash('md5').update(decl).digest('hex').slice(0, 6);
      INLINE_STYLES.set(cls, decl);
      classes.push(cls);
      continue;
    }
    if (!/^[a-z0-9-]+$/.test(k) || !/^[a-z0-9-]*$/.test(v)) return null;
    classes.push(v === '' ? `lu-attr__${k}` : `lu-attr__${k}__${v}`);
  }
  return { classes, id };
}

// Photos become native Image widgets; Elementor downloads them into the Media Library on import.
function imageWidget(pic) {
  const img = pic.querySelector('img');
  const name = img.getAttribute('src').match(/photos\/(.+)-\d+\.jpg$/)[1];
  const widths = [...pic.querySelectorAll('source')].flatMap((s) => [...s.getAttribute('srcset').matchAll(/-(\d+)\.webp/g)].map((m) => +m[1]));
  const enc = encodeAttrs(pic);
  return widget('image', {
    image: { url: `${IMG_BASE}assets/img/photos/${name}-${Math.max(...widths)}.webp`, id: '', alt: img.getAttribute('alt') || '', source: 'library' },
    image_size: 'full',
    _css_classes: ['lu-w', ...enc.classes].join(' '),
  });
}
const html = (markup) => widget('html', { html: markup });

function containerable(el) {
  if (!CONTAINER_TAGS.has(tag(el)) || hasText(el)) return false;
  if (el.querySelector('form,input,button,select,textarea,details,script,canvas,template')) return false;
  if (!encodeAttrs(el)) return false;
  // Only worth a container if something inside becomes a native widget.
  const kids = el.childNodes.filter(isEl);
  return kids.some((k) => isRich(k) || isPhoto(k) || containerable(k));
}

function convertChildren(el, inner) {
  const out = [];
  let run = [];
  const flush = () => { if (run.length) out.push(widget('text-editor', { editor: run.join('\n') })); run = []; };
  for (const k of el.childNodes) {
    if (!isEl(k)) continue;
    if (isRich(k)) { run.push(k.outerHTML); continue; }
    flush();
    out.push(convert(k, inner));
  }
  flush();
  return out;
}

function convert(el, inner = true) {
  if (isRich(el)) return widget('text-editor', { editor: el.outerHTML });
  if (isPhoto(el)) return imageWidget(el);
  if (containerable(el)) {
    const enc = encodeAttrs(el);
    const s = { css_classes: ['lu-c', ...enc.classes].join(' ') };
    if (enc.id) s._element_id = enc.id;
    if (tag(el) !== 'div') s.html_tag = tag(el);
    if (tag(el) === 'a') s.link = { url: el.getAttribute('href'), is_external: '', nofollow: '' };
    return container(s, convertChildren(el, true), inner);
  }
  return html(el.outerHTML);
}

/* ---------- Pages ---------- */
function convertPage(file) {
  idSeed = file; idCount = 0;
  const doc = parse(readFileSync(DIST + file, 'utf8'), { comment: false, blockTextElements: { script: true, style: true, pre: true } });
  const body = doc.querySelector('body');
  rewriteUrls(body);
  const kids = body.childNodes.filter(isEl);
  const main = body.querySelector('main');
  const before = kids.slice(0, kids.indexOf(main));
  const after = kids.slice(kids.indexOf(main) + 1);
  if (after.some((k) => tag(k) === 'script')) throw new Error(file + ': body scripts not handled');
  const chrome = (els, title) => container({ css_classes: 'lu-c lu-contents', _title: title }, [html(els.map((e) => e.outerHTML).join('\n'))], false);
  const mainEnc = encodeAttrs(main);
  const content = [
    chrome(before, 'Header'),
    container({ css_classes: ['lu-c', ...mainEnc.classes].join(' '), _element_id: mainEnc.id || 'main', html_tag: 'main', _title: 'Page content' },
      main.childNodes.filter(isEl).map((s) => convert(s, true)), false),
    chrome(after, 'Footer'),
  ];
  return content;
}

/* ---------- Stats for the report ---------- */
function count(els, acc = {}) {
  for (const e of els) { const k = e.elType === 'widget' ? e.widgetType : 'container'; acc[k] = (acc[k] || 0) + 1; count(e.elements, acc); }
  return acc;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT + 'kit/content/page', { recursive: true });
mkdirSync(OUT + 'templates', { recursive: true });
const manifestPages = {};
const pageSettings = { template: 'elementor_canvas' };
PAGES.forEach(([file, title], i) => {
  const id = 101 + i;
  const content = convertPage(file);
  writeFileSync(`${OUT}kit/content/page/${id}.json`, JSON.stringify({ content, settings: pageSettings, metadata: [] }));
  writeFileSync(`${OUT}templates/learn-uk-${slugOf(file)}.json`, JSON.stringify({ version: '0.4', title: `Learn UK: ${title}`, type: 'page', content, page_settings: pageSettings }));
  manifestPages[id] = { title, excerpt: '', doc_type: 'wp-page', thumbnail: false, url: `${HOME}${slugOf(file)}/`, terms: [], ...(file === 'index.html' ? { show_on_front: true } : {}) };
  console.log(file.padEnd(26), JSON.stringify(count(content)));
});
writeFileSync(OUT + 'inline-styles.css', [...INLINE_STYLES].map(([c, d]) => `.lu .${c} { ${d.split(';').map((x) => x.trim() + ' !important').join('; ')}; }`).join('\n') + '\n');
writeFileSync(OUT + 'pages.json', JSON.stringify(manifestPages, null, 1));
