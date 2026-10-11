// Static site generator for Learn UK. `node src/build.mjs` writes dist/.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = ROOT + 'src/';
const OUT = ROOT + 'dist/';
const LOGO = ROOT + 'static/logo/';

const { universities } = JSON.parse(readFileSync(SRC + 'data/universities.json'));
const { courses } = JSON.parse(readFileSync(SRC + 'data/courses.json'));
const uniBySlug = Object.fromEntries(universities.map((u) => [u.slug, u]));

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const gbp = (n) => '£' + n.toLocaleString('en-GB');

/* ---------- Icons (inline, decorative) ---------- */
const P = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  camera: '<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>',
  passport: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M9 16h6"/>',
  plane: '<path d="M2.5 13.5l19-8-5 15-4-6-6 3z"/><path d="M12.5 14.5l9-9"/>',
  home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6"/>',
  pound: '<path d="M16 6.5A4 4 0 0 0 9 9v8M6 13h8M6 20h12"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  heart: '<path d="M12 20s-7.5-4.5-7.5-10A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3c0 5.5-7.5 10-7.5 10z"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
};
const icon = (n, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" ${extra}>${P[n]}</svg>`;

const photo = (brief, ar = '4 / 3', extra = '') => `<div class="photo-slot" style="--ar:${ar}" role="img" aria-label="Photo placeholder: ${esc(brief)}" ${extra}><span>${icon('camera')}<b>Photo slot</b>${esc(brief)}</span></div>`;

/* ---------- Site chrome ---------- */
const NAV = [
  { href: 'index.html', label: 'Home' },
  { group: 'Study', items: [
    { href: 'universities.html', label: 'Universities', desc: 'Compare UK universities and cities' },
    { href: 'courses.html', label: 'Courses', desc: 'Search courses by subject and level' },
    { href: 'application-journey.html', label: 'Application journey', desc: 'Every step from enquiry to arrival' },
  ] },
  { href: 'services.html', label: 'Services' },
  { href: 'about.html', label: 'About' },
  { href: 'faqs.html', label: 'FAQs' },
];

function header(current) {
  const studyActive = NAV[1].items.some((i) => i.href === current);
  const desktop = NAV.map((n) => n.group
    ? `<li class="has-dropdown"><button class="nav-trigger" type="button" aria-expanded="false" aria-controls="dd-study"${studyActive ? ' data-active' : ''}>${n.group}${icon('chevron')}</button>
        <ul class="dropdown" id="dd-study">${n.items.map((i) => `<li><a href="${i.href}"${i.href === current ? ' aria-current="page"' : ''}><strong>${i.label}</strong><span>${i.desc}</span></a></li>`).join('')}</ul></li>`
    : `<li><a class="nav-link" href="${n.href}"${n.href === current ? ' aria-current="page"' : ''}>${n.label}</a></li>`).join('');
  const flat = NAV.flatMap((n) => n.group ? n.items : [n]);
  return `<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="index.html" aria-label="Learn UK home"><img src="assets/img/learn-uk-wordmark-white.svg" alt="Learn UK" width="136" height="26"></a>
    <nav class="nav" aria-label="Main"><ul class="nav-list">${desktop}</ul></nav>
    <a class="btn btn--amber header-cta" href="contact.html">Book a free consultation</a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-menu"><span class="visually-hidden">Open menu</span><span class="bars" aria-hidden="true"><span class="bar"></span><span class="bar"></span><span class="bar"></span></span></button>
  </div>
</header>
<div class="mobile-menu" id="mobile-menu">
  <nav aria-label="Main mobile">
    <ul>${flat.map((i) => `<li><a href="${i.href}"${i.href === current ? ' aria-current="page"' : ''}>${i.label}</a></li>`).join('')}<li><a href="contact.html"${current === 'contact.html' ? ' aria-current="page"' : ''}>Contact</a></li></ul>
  </nav>
  <a class="btn btn--amber btn--block" href="contact.html">Book a free consultation ${icon('arrow')}</a>
</div>`;
}

const footer = () => `<footer class="site-footer on-dark">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <img src="assets/img/learn-uk-wordmark-white.svg" alt="Learn UK" width="160" height="31" loading="lazy">
        <p>Guidance for international students, from first question to first day at a UK university.</p>
      </div>
      <div><h2>Study</h2><ul><li><a href="universities.html">Universities</a></li><li><a href="courses.html">Courses</a></li><li><a href="application-journey.html">Application journey</a></li></ul></div>
      <div><h2>Learn UK</h2><ul><li><a href="services.html">Services</a></li><li><a href="about.html">About us</a></li><li><a href="faqs.html">FAQs</a></li><li><a href="contact.html">Contact</a></li></ul></div>
      <div><h2>Talk to us</h2><ul><li><a href="contact.html">Book a free consultation</a></li><li><a href="mailto:hello@learnuk.example">hello@learnuk.example</a></li></ul><p class="hint" style="font-size:.85rem;margin-top:.5rem">Placeholder contact details: replace before launch.</p></div>
    </div>
    <div class="footer-base"><span>© 2026 Learn UK. All rights reserved.</span><span>Privacy policy and terms: to be added before launch.</span></div>
  </div>
</footer>`;

let ASSET_V = '';
function page({ file, title, description, body, preloadHero = false }) {
  const full = file === 'index.html' ? 'Learn UK | Study at a UK university' : `${title} | Learn UK`;
  return `<!doctype html>
<html lang="en-GB" class="js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#0B1640">
<link rel="icon" href="assets/img/learn-uk-favicon.svg" type="image/svg+xml">
<link rel="preload" href="assets/fonts/urbanist-latin-wght.woff2" as="font" type="font/woff2" crossorigin>
${preloadHero ? '<link rel="preload" as="image" href="assets/img/globe-720.avif" imagesrcset="assets/img/globe-480.avif 480w, assets/img/globe-720.avif 720w, assets/img/globe-960.avif 960w, assets/img/globe-1280.avif 1280w" imagesizes="(min-width: 64em) 44rem, (min-width: 48em) 28rem, 22rem" type="image/avif" fetchpriority="high">' : ''}
<link rel="stylesheet" href="assets/css/site.css?v=${ASSET_V}">
<script>setTimeout(function(){if(!window.__lukReady)document.documentElement.classList.add('js-failed')},2500)</script>
<script type="module" src="assets/js/main.js?v=${ASSET_V}"></script>
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
</head>
<body>
${header(file)}
<main id="main" tabindex="-1">
${body}
</main>
${footer()}
</body>
</html>
`;
}

const pageHero = (crumb, eyebrow, h1, lede, extra = '') => `<section class="page-hero on-dark">
  <div class="container">
    <nav aria-label="Breadcrumb"><ol class="breadcrumb"><li><a href="index.html">Home</a></li><li aria-current="page">${crumb}</li></ol></nav>
    <p class="eyebrow">${eyebrow}</p>
    <h1>${h1}</h1>
    <p class="lede">${lede}</p>${extra}
  </div>
</section>`;

const sampleNote = (what) => `<p class="sample-note">${icon('info')}<span><strong>Sample data.</strong> ${what} are placeholders for design and testing. Replace them with verified university information before launch.</span></p>`;

const ctaBand = (h = 'Not sure where to start?', p = 'Book a free consultation. We will talk through your goals, your grades and your budget, then suggest a shortlist that fits.') => `<section class="section"><div class="container"><div class="cta-band reveal">
  <div><h2>${h}</h2><p>${p}</p></div>
  <div><a class="btn btn--amber" href="contact.html">Book a free consultation ${icon('arrow')}</a></div>
</div></div></section>`;

/* ---------- Shared content ---------- */
const SERVICES = [
  ['compass', 'Course and university matching', 'We shortlist courses that fit your grades, goals, budget and preferred city, and explain the trade-offs honestly.'],
  ['doc', 'Application support', 'Help with UCAS and direct applications, personal statements, references and the documents universities ask for.'],
  ['chat', 'English language guidance', 'Which English tests your chosen universities accept, the scores they ask for, and how to prepare.'],
  ['pound', 'Scholarships and budgeting', 'Find scholarships you can apply for and plan a realistic budget for fees and living costs.'],
  ['passport', 'Student visa guidance', 'A clear checklist for your CAS, financial evidence and visa documents, so nothing holds up your application.'],
  ['plane', 'Pre-departure and arrival', 'Accommodation options, what to pack, and what to do in your first week in the UK.'],
];

const JOURNEY = [
  ['Free consultation', 'Tell us what you want to study and where you are now. We explain your options and what each route involves.', 'Week 1'],
  ['Shortlist courses', 'We match you with courses and universities that fit your grades, budget and goals, and check entry requirements.', 'Weeks 1–3'],
  ['Apply', 'Prepare your personal statement and documents, then apply through UCAS (undergraduate) or directly to universities (postgraduate).', 'Months before your intake'],
  ['Accept your offer', 'Meet any conditions, accept your offer and pay your deposit. Your university then issues your CAS.', 'After your offer'],
  ['Student visa', 'Use our checklist to gather your documents and complete your visa application with confidence.', 'Up to 6 months before your course'],
  ['Arrive in the UK', 'Pre-departure briefing, accommodation help and support through your first weeks on campus.', 'Your first term'],
];

const FAQS = [
  { group: 'Getting started', items: [
    ['Is the first consultation really free?', 'Yes. Your first consultation is free and there is no obligation to use our services afterwards. We will tell you upfront if any later service has a cost.'],
    ['When should I start planning?', 'Ideally 9 to 12 months before your course starts. Many courses begin in September, and some also have a January intake. Starting early gives you time for English tests, applications and your visa.'],
    ['Can you help if I have not chosen a subject yet?', 'Yes. We will talk through your interests, strengths and career plans and show you how different courses lead to different options.'],
  ] },
  { group: 'Applications', items: [
    ['How do I apply for an undergraduate course?', 'Most undergraduate applications go through UCAS, the UK’s central admissions service. We help you choose your courses, write your personal statement and check your application before you submit.'],
    ['How do postgraduate applications work?', 'Most postgraduate applications go directly to each university. Requirements vary, so we check what each course asks for and help you prepare your documents.'],
    ['Do I need an English test?', 'Usually, unless you are from a majority English-speaking country or meet a university’s exemption rules. Universities set their own accepted tests and scores, and we will check them for each course on your shortlist.'],
  ] },
  { group: 'Costs and funding', items: [
    ['How much does it cost to study in the UK?', 'Tuition fees for international students vary widely by university, subject and level. You also need to budget for living costs, which depend on the city. We help you build a realistic budget for your shortlist.'],
    ['Are there scholarships for international students?', 'Many universities offer scholarships or fee discounts, and there are government and external schemes too. We help you find the ones you are eligible for and meet their deadlines.'],
  ] },
  { group: 'Visas and arrival', items: [
    ['Can you apply for my visa for me?', 'You make your own Student visa application. We give you a clear checklist and help you understand what each document is for. Always check the latest rules on <a href="https://www.gov.uk/student-visa">GOV.UK</a>.'],
    ['What is a CAS?', 'A Confirmation of Acceptance for Studies (CAS) is a reference number your university gives you once you have accepted an unconditional offer. You need it to apply for your Student visa.'],
    ['Will you help me find accommodation?', 'Yes. We explain the options, from university halls to private housing, and help you apply before you travel.'],
  ] },
];

const faqList = (items, open = false) => `<div class="faq">${items.map(([q, a], i) => `<details${open && i === 0 ? ' open' : ''}><summary><span class="q">${q}</span><span class="chev">${icon('chevron')}</span></summary><div class="answer"><p>${a}</p></div></details>`).join('')}</div>`;

const uniCard = (u, i = 0) => `<article class="card reveal" style="--i:${i % 3}" data-tilt data-item data-nation="${esc(u.nation)}" data-intake="${u.intakes.join('|')}" data-search="${esc([u.name, u.city, u.area, u.nation].join(' '))}">
  <div class="card-media">${photo(`Students on campus at ${u.name}`, '16 / 10')}</div>
  <div class="card-body">
    <h3><a class="card-link" href="courses.html?university=${u.slug}">${esc(u.name)}</a></h3>
    <p>${icon('pin', 'style="width:1em;height:1em;display:inline;vertical-align:-.125em;margin-right:.25rem"')}${esc(u.city)}, ${esc(u.area)}</p>
    <ul class="meta"><li class="tag">${esc(u.setting)} university</li>${u.intakes.map((m) => `<li class="tag tag--royal">${m} intake</li>`).join('')}</ul>
    <div class="card-foot"><span><strong>${u.courseCount}</strong> sample courses</span><span class="text-link" aria-hidden="true">View courses ${icon('arrow')}</span></div>
  </div>
</article>`;

const courseCard = (c, i = 0) => {
  const u = uniBySlug[c.university];
  return `<article class="card course-card reveal" style="--i:${i % 3}" data-tilt data-item data-level="${c.level}" data-subject="${esc(c.subject)}" data-intake="${c.intakes.join('|')}" data-university="${c.university}" data-search="${esc([c.title, c.subject, u.name, u.city].join(' '))}">
  <div class="card-body">
    <h3>${esc(c.title)}</h3>
    <p>${esc(u.name)} · ${esc(u.city)}</p>
    <ul class="meta"><li class="tag tag--royal">${c.level}</li><li class="tag">${esc(c.subject)}</li><li class="tag">${icon('clock', 'style="width:.9em;height:.9em"')} ${c.duration}</li><li class="tag">${icon('calendar', 'style="width:.9em;height:.9em"')} ${c.intakes.join(' and ')}</li>${c.foundationAvailable ? '<li class="tag tag--amber">Foundation year available</li>' : ''}</ul>
    <div class="card-foot"><span>From <strong>${gbp(c.feeFromGBP)}</strong> a year<br><small>Sample fee</small></span><a class="btn btn--ghost" href="contact.html?course=${encodeURIComponent(`${c.title}, ${u.name}`)}">Enquire<span class="visually-hidden"> about ${esc(c.title)} at ${esc(u.name)}</span> ${icon('arrow')}</a></div>
  </div>
</article>`;
};

const options = (list, all) => `<option value="">${all}</option>` + list.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
const subjects = [...new Set(courses.map((c) => c.subject))].sort();
const nations = [...new Set(universities.map((u) => u.nation))];

/* ---------- Pages ---------- */
const pages = [];

pages.push({ file: 'index.html', title: 'Home', preloadHero: true,
  description: 'Learn UK helps international students find, apply for and start the right course at a UK university. Book a free consultation.',
  body: `<section class="hero on-dark" aria-labelledby="hero-title">
  <div class="container hero-inner">
    <div class="hero-copy">
      <p class="eyebrow hero-anim" data-d="1">UK university admissions support</p>
      <h1 id="hero-title">Your journey to a <em>UK university</em> starts here</h1>
      <p class="lede hero-anim" data-d="1">Wherever you are in the world, we help you choose the right course, apply with confidence and arrive ready to start.</p>
      <div class="search-card hero-anim" data-d="2">
        <form data-lead novalidate aria-labelledby="lead-title" action="#" method="post">
          <p class="search-title" id="lead-title">Get a free call back</p>
          <p class="lead-hint" id="lead-hint">Leave your details and an adviser will contact you.</p>
          <div class="search-grid">
            <div class="field">
              <label for="lead-phone">Phone or WhatsApp</label>
              <input class="input" id="lead-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" pattern="[+0-9 ()-]{7,20}" placeholder="+880 1711 000000" required aria-describedby="lead-hint lead-phone-error">
              <p class="error" id="lead-phone-error">${icon('info', 'style="width:1rem;height:1rem;flex:none"')}<span>Enter a phone number, including your country code</span></p>
            </div>
            <div class="field">
              <label for="lead-email">Email address</label>
              <input class="input" id="lead-email" name="email" type="email" pattern="[^@\\s]+@[^@\\s]+\\.[^@\\s]+" autocomplete="email" inputmode="email" spellcheck="false" placeholder="you@email.com" required aria-describedby="lead-email-error">
              <p class="error" id="lead-email-error">${icon('info', 'style="width:1rem;height:1rem;flex:none"')}<span>Enter an email address, like name@example.com</span></p>
            </div>
            <button class="btn" type="submit"><span data-label>Request a call</span> ${icon('arrow')}</button>
          </div>
        </form>
        <div class="lead-success" data-lead-success hidden tabindex="-1">
          <span class="lead-tick">${icon('check')}</span>
          <div><p class="search-title">Thanks, we will be in touch</p><p class="lead-hint">An adviser will contact you soon. <span class="preview-note">Preview: this form is not connected yet, so nothing was sent.</span></p></div>
        </div>
      </div>
      <div class="hero-actions hero-anim" data-d="3">
        <a class="btn btn--amber" href="contact.html">Book a free consultation ${icon('arrow')}</a>
        <a class="btn btn--ghost-light" href="application-journey.html">How it works</a>
      </div>
      <ul class="hero-trust hero-anim" data-d="4">
        <li>${icon('check')} Free first consultation</li>
        <li>${icon('check')} Course, application and visa guidance</li>
        <li>${icon('check')} Support from enquiry to arrival</li>
      </ul>
    </div>
    <div class="hero-visual" data-globe>
      <picture>
        <source type="image/avif" srcset="assets/img/globe-480.avif 480w, assets/img/globe-720.avif 720w, assets/img/globe-960.avif 960w, assets/img/globe-1280.avif 1280w" sizes="(min-width: 64em) 44rem, (min-width: 48em) 28rem, 22rem">
        <source type="image/webp" srcset="assets/img/globe-480.webp 480w, assets/img/globe-720.webp 720w, assets/img/globe-960.webp 960w, assets/img/globe-1280.webp 1280w" sizes="(min-width: 64em) 44rem, (min-width: 48em) 28rem, 22rem">
        <img src="assets/img/globe-720.png" width="720" height="720" alt="A globe with the United Kingdom highlighted in amber and paths arriving from around the world" fetchpriority="high" decoding="async">
      </picture>
      <button class="globe-toggle" type="button" aria-pressed="false"><span data-icon="pause">${icon('pause')}</span><span data-icon="play" hidden>${icon('play')}</span><span data-label>Pause animation</span></button>
    </div>
  </div>
</section>

<section class="section section--mist" aria-labelledby="why-title">
  <div class="container">
    <div class="section-head reveal"><div><p class="eyebrow">Why study in the UK</p><h2 id="why-title">World-class degrees, often in less time</h2><p>UK courses are focused and intensive, so you can graduate sooner and start your career earlier.</p></div></div>
    <dl class="stats">
      <div class="stat reveal" style="--i:0"><dt>for most undergraduate degrees in England, Wales and Northern Ireland</dt><dd>3 years</dd></div>
      <div class="stat reveal" style="--i:1"><dt>for most taught master’s degrees</dt><dd>1 year</dd></div>
      <div class="stat reveal" style="--i:2"><dt>main intakes: September, with January on many courses</dt><dd>2 intakes</dd></div>
    </dl>
  </div>
</section>

<section class="section" aria-labelledby="services-title">
  <div class="container">
    <div class="section-head reveal"><div><p class="eyebrow">How we help</p><h2 id="services-title">Support at every step</h2><p>One team to guide you from your first question to your first lecture.</p></div><a class="text-link" href="services.html">All services ${icon('arrow')}</a></div>
    <div class="grid grid--3">${SERVICES.map(([ic, h, p], i) => `<div class="feature reveal" style="--i:${i % 3}"><div class="icon-tile">${icon(ic)}</div><h3>${h}</h3><p>${p}</p></div>`).join('')}</div>
  </div>
</section>

<section class="section section--mist" aria-labelledby="unis-title">
  <div class="container">
    <div class="section-head reveal"><div><p class="eyebrow">Universities</p><h2 id="unis-title">Explore universities across the UK</h2><p>From city campuses to green parkland, in England, Scotland, Wales and Northern Ireland.</p></div><a class="text-link" href="universities.html">All universities ${icon('arrow')}</a></div>
    ${sampleNote('Course counts and intakes')}
    <div class="grid grid--3">${universities.slice(0, 6).map(uniCard).join('')}</div>
  </div>
</section>

<section class="section" aria-labelledby="journey-title">
  <div class="container">
    <div class="section-head reveal"><div><p class="eyebrow">The application journey</p><h2 id="journey-title">Six steps from enquiry to arrival</h2><p>We stay with you through every stage, so you always know what comes next.</p></div><a class="text-link" href="application-journey.html">See the full journey ${icon('arrow')}</a></div>
    <ol class="journey journey--row">${JOURNEY.map(([h, p]) => `<li class="journey-step"><span class="journey-num" aria-hidden="true"></span><div><h3>${h}</h3><p>${p}</p></div></li>`).join('')}</ol>
  </div>
</section>

<section class="section section--mist" aria-labelledby="stories-title">
  <div class="container">
    <div class="section-head reveal"><div><p class="eyebrow">Student stories</p><h2 id="stories-title">Students who made the journey</h2><p>Real stories from Learn UK students will appear here once they have given permission.</p></div></div>
    <div class="grid grid--3">${[1, 2, 3].map((n, i) => `<figure class="quote reveal" style="--i:${i}">${photo('Student portrait', '1')}<div><blockquote><p>Placeholder for a real student testimonial, quoted in their own words with their permission.</p></blockquote><figcaption>Student name, course and university</figcaption></div></figure>`).join('')}</div>
  </div>
</section>

<section class="section" aria-labelledby="faq-title">
  <div class="container split">
    <div class="reveal"><p class="eyebrow">FAQs</p><h2 id="faq-title">Questions students often ask</h2><p class="lede">Can’t find your answer? Ask us in a free consultation.</p><a class="text-link" href="faqs.html">All FAQs ${icon('arrow')}</a></div>
    <div class="reveal">${faqList([FAQS[0].items[0], FAQS[0].items[1], FAQS[1].items[0], FAQS[3].items[1]])}</div>
  </div>
</section>
${ctaBand()}` });

pages.push({ file: 'universities.html', title: 'Universities', description: 'Explore UK universities by nation, city and intake, and find courses that suit you.',
  body: `${pageHero('Universities', 'Study', 'Find a UK university that fits you', 'Compare universities across England, Scotland, Wales and Northern Ireland, then explore their courses.')}
<section class="section section--mist">
  <div class="container">
    ${sampleNote('The universities list, course counts and intakes')}
    <form class="filters filters--3" data-filter-form data-noun="universities" aria-label="Filter universities">
      <div class="field"><label for="f-q">Search</label><input class="input" id="f-q" name="q" type="search" placeholder="University or city" autocomplete="off"></div>
      <div class="field"><label for="f-nation">Nation</label><select class="select" id="f-nation" name="nation">${options(nations, 'All nations')}</select></div>
      <div class="field"><label for="f-intake">Intake</label><select class="select" id="f-intake" name="intake">${options(['September', 'January'], 'Any intake')}</select></div>
    </form>
    <div data-results-region>
      <div class="results-bar"><p class="results-count" role="status" aria-live="polite"><span class="spinner" aria-hidden="true"></span><span data-count>${universities.length} universities found</span></p></div>
      <h2 class="visually-hidden">Universities</h2>
      <div class="grid grid--3 results">${universities.map(uniCard).join('')}</div>
      <div class="empty-state" data-empty hidden><p><strong>No universities match those filters.</strong></p><p>Try a different city or clear a filter. Or <a href="contact.html">ask an adviser</a> to suggest options.</p></div>
    </div>
  </div>
</section>
${ctaBand('Want help choosing?', 'An adviser can shortlist universities for your subject, grades and budget.')}` });

pages.push({ file: 'courses.html', title: 'Courses', description: 'Search undergraduate and postgraduate courses at UK universities by subject, level and intake.',
  body: `${pageHero('Courses', 'Study', 'Search UK courses', 'Filter by subject, level, university and intake. Every result links straight to an enquiry.')}
<section class="section section--mist">
  <div class="container">
    ${sampleNote('Course titles, durations, intakes and fees')}
    <form class="filters" data-filter-form data-noun="courses" aria-label="Filter courses">
      <div class="field"><label for="c-q">Search</label><input class="input" id="c-q" name="q" type="search" placeholder="For example, computer science" autocomplete="off"></div>
      <div class="field"><label for="c-level">Level</label><select class="select" id="c-level" name="level">${options(['Undergraduate', 'Postgraduate'], 'Any level')}</select></div>
      <div class="field"><label for="c-subject">Subject</label><select class="select" id="c-subject" name="subject">${options(subjects, 'All subjects')}</select></div>
      <div class="field"><label for="c-intake">Intake</label><select class="select" id="c-intake" name="intake">${options(['September', 'January'], 'Any intake')}</select></div>
      <div class="field"><label for="c-uni">University</label><select class="select" id="c-uni" name="university"><option value="">All universities</option>${universities.map((u) => `<option value="${u.slug}">${esc(u.name)}</option>`).join('')}</select></div>
    </form>
    <div data-results-region>
      <div class="results-bar"><p class="results-count" role="status" aria-live="polite"><span class="spinner" aria-hidden="true"></span><span data-count>${courses.length} courses found</span></p><button class="btn btn--ghost" type="button" data-clear>Clear filters</button></div>
      <h2 class="visually-hidden">Courses</h2>
      <div class="course-row results">${courses.map(courseCard).join('')}</div>
      <div class="empty-state" data-empty hidden><p><strong>No courses match those filters.</strong></p><p>Try a broader search or clear a filter. Or <a href="contact.html">ask an adviser</a> about courses not listed here.</p></div>
    </div>
  </div>
</section>
${ctaBand('Can’t see your course?', 'This list is a starting point. Our advisers can search the full range of UK courses with you.')}` });

pages.push({ file: 'application-journey.html', title: 'Application journey', description: 'The six steps from your first enquiry to arriving at a UK university, and how Learn UK supports each one.',
  body: `${pageHero('Application journey', 'How it works', 'From first question to first lecture', 'Six clear steps, with an adviser beside you for each one. Scroll to follow the journey.')}
<section class="section">
  <div class="container" style="max-width:52rem">
    <div class="journey-wrap"><span class="journey-progress" aria-hidden="true"></span>
    <ol class="journey">${JOURNEY.map(([h, p, when]) => `<li class="journey-step"><span class="journey-num" aria-hidden="true"></span><div><p class="when">${when}</p><h2 style="font-size:var(--step-2)">${h}</h2><p>${p}</p></div></li>`).join('')}</ol></div>
    <p class="sample-note" style="margin-top:var(--space-4)">${icon('info')}<span>Timings are typical and vary by course, university and nationality. Visa rules change, so always check the current requirements on <a href="https://www.gov.uk/student-visa">GOV.UK</a>.</span></p>
  </div>
</section>
${ctaBand('Ready for step one?', 'Your free consultation is the start of the journey. Tell us about your plans and we will map out the rest.')}` });

pages.push({ file: 'services.html', title: 'Services', description: 'Course matching, application support, English test guidance, scholarships, visa guidance and arrival support for international students.',
  body: `${pageHero('Services', 'Services', 'Everything you need to study in the UK', 'Practical, honest guidance at every stage, so you can make decisions with confidence.')}
<section class="section">
  <div class="container">
    <div class="grid grid--3">${SERVICES.map(([ic, h, p], i) => `<div class="feature reveal" style="--i:${i % 3}"><div class="icon-tile">${icon(ic)}</div><h2 style="font-size:var(--step-1)">${h}</h2><p>${p}</p></div>`).join('')}</div>
  </div>
</section>
<section class="section section--mist">
  <div class="container split">
    <div class="stack-photos reveal">${photo('Adviser meeting a student and family', '4 / 3')}${photo('Student reviewing documents', '1')}</div>
    <div class="reveal">
      <p class="eyebrow">What to expect</p>
      <h2>A plan that fits you, not a sales pitch</h2>
      <ul class="list-check">
        <li>${icon('check')}<span>A named adviser who knows your application.</span></li>
        <li>${icon('check')}<span>Clear checklists and deadlines for every step.</span></li>
        <li>${icon('check')}<span>Straight answers about costs, entry requirements and timings.</span></li>
        <li>${icon('check')}<span>Updates by email, phone or messaging, whichever you prefer.</span></li>
      </ul>
      <p class="hint" style="margin-top:var(--space-3);font-size:.9rem;color:var(--ink-soft)">Service list and visa wording to be confirmed by Learn UK, including any regulatory requirements for immigration advice.</p>
    </div>
  </div>
</section>
${ctaBand()}` });

pages.push({ file: 'about.html', title: 'About us', description: 'Learn UK helps international students find and start the right course at a UK university.',
  body: `${pageHero('About', 'About Learn UK', 'Helping students make the move with confidence', 'Moving to another country to study is a big decision. We make each step clearer.')}
<section class="section">
  <div class="container split">
    <div class="reveal">
      <p class="eyebrow">Our mission</p>
      <h2>The right course, not just any course</h2>
      <p>Learn UK guides international students through choosing, applying for and starting a degree at a UK university. We focus on fit: the course, the city and the budget that suit each student.</p>
      <p>Placeholder copy: Learn UK to add its story, founding year, team size, offices and university relationships.</p>
    </div>
    <div class="reveal">${photo('Learn UK team at work, natural light from the left', '4 / 3')}</div>
  </div>
</section>
<section class="section section--mist">
  <div class="container">
    <div class="section-head reveal"><div><p class="eyebrow">What we believe</p><h2>How we work</h2></div></div>
    <div class="grid grid--3">
      <div class="feature reveal" style="--i:0"><div class="icon-tile">${icon('shield')}</div><h3>Honest advice</h3><p>We tell you what you need to know, including when a course is not the right fit.</p></div>
      <div class="feature reveal" style="--i:1"><div class="icon-tile">${icon('heart')}</div><h3>Student first</h3><p>Your goals shape the shortlist. We explain every option and the reasons behind it.</p></div>
      <div class="feature reveal" style="--i:2"><div class="icon-tile">${icon('cap')}</div><h3>With you to the end</h3><p>Support continues after your offer: visa, travel, accommodation and your first weeks.</p></div>
    </div>
  </div>
</section>
<section class="section">
  <div class="container">
    <div class="section-head reveal"><div><p class="eyebrow">Our team</p><h2>Meet the advisers</h2><p>Team profiles will appear here.</p></div></div>
    <div class="grid grid--4">${['Adviser portrait', 'Adviser portrait', 'Adviser portrait', 'Adviser portrait'].map((b, i) => `<figure class="reveal" style="--i:${i};margin:0">${photo(b, '4 / 5')}<figcaption style="margin-top:.6rem"><strong>Name</strong><br><span style="color:var(--ink-soft)">Role and languages spoken</span></figcaption></figure>`).join('')}</div>
  </div>
</section>
${ctaBand()}` });

pages.push({ file: 'faqs.html', title: 'FAQs', description: 'Answers to common questions about studying in the UK: applications, costs, scholarships, visas and arrival.',
  body: `${pageHero('FAQs', 'FAQs', 'Your questions, answered', 'Common questions about applying to UK universities. If yours is not here, ask us.')}
<section class="section">
  <div class="container" style="max-width:52rem">
    ${FAQS.map((g) => `<div class="faq-group reveal"><h2 style="font-size:var(--step-2)">${g.group}</h2>${faqList(g.items)}</div>`).join('')}
  </div>
</section>
${ctaBand('Still have a question?', 'Ask an adviser in a free, no-obligation consultation.')}` });

const countries = ['Bangladesh', 'China', 'Egypt', 'Ghana', 'India', 'Indonesia', 'Kenya', 'Malaysia', 'Nepal', 'Nigeria', 'Pakistan', 'Saudi Arabia', 'Sri Lanka', 'Thailand', 'Turkey', 'United Arab Emirates', 'Vietnam', 'Another country'];
const field = (id, label, control, { hint = '', error = true } = {}) => `<div class="field"${''}>
  <label for="${id}">${label}</label>${hint ? `<p class="hint" id="${id}-hint">${hint}</p>` : ''}
  ${control}
  ${error ? `<p class="error" id="${id}-error">${icon('info', 'style="width:1rem;height:1rem;flex:none"')}<span></span></p>` : ''}
</div>`;
const desc = (id, hint) => `aria-describedby="${hint ? `${id}-hint ` : ''}${id}-error"`;

pages.push({ file: 'contact.html', title: 'Book a free consultation', description: 'Book a free, no-obligation consultation with a Learn UK adviser about studying at a UK university.',
  body: `${pageHero('Contact', 'Free consultation', 'Book a free consultation', 'Tell us a little about your plans and an adviser will get in touch to arrange a time that suits you.')}
<section class="section section--mist">
  <div class="container contact-layout">
    <div class="panel">
      <form data-enquiry novalidate aria-labelledby="form-title" action="#" method="post">
        <h2 id="form-title" style="font-size:var(--step-2)">Your details</h2>
        <p style="color:var(--ink-soft)">All fields are required unless marked optional.</p>
        <div class="error-summary" data-error-summary tabindex="-1" role="alert" hidden><h2>There is a problem</h2><ul></ul></div>
        <div class="form-grid form-grid--2">
          ${field('name', 'Full name', `<input class="input" id="name" name="name" type="text" autocomplete="name" required data-validate ${desc('name')}>`)}
          ${field('email', 'Email address', `<input class="input" id="email" name="email" type="email" pattern="[^@\\s]+@[^@\\s]+\\.[^@\\s]+" autocomplete="email" inputmode="email" spellcheck="false" required data-validate ${desc('email')}>`)}
          ${field('phone', 'Phone or WhatsApp number (optional)', `<input class="input" id="phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" pattern="[+0-9 ()-]{7,20}" data-validate ${desc('phone', true)}>`, { hint: 'Include your country code, for example +880' })}
          ${field('country', 'Country you live in', `<select class="select" id="country" name="country" autocomplete="country-name" required data-validate ${desc('country')}><option value="">Select a country</option>${countries.map((c) => `<option>${c}</option>`).join('')}</select>`)}
          ${field('level', 'Level of study', `<select class="select" id="level" name="level" required data-validate ${desc('level')}><option value="">Select a level</option><option>Foundation</option><option>Undergraduate</option><option>Postgraduate</option><option>Not sure yet</option></select>`)}
          ${field('intake', 'Preferred start (optional)', `<select class="select" id="intake" name="intake"><option value="">Not sure yet</option><option>January 2027</option><option>September 2027</option><option>January 2028</option><option>September 2028</option></select>`, { error: false })}
          <div class="span-2">${field('interest', 'Course or subject you are interested in (optional)', `<input class="input" id="interest" name="interest" type="text" autocomplete="off">`, { error: false })}</div>
          <div class="span-2">${field('message', 'Anything else we should know? (optional)', `<textarea class="textarea" id="message" name="message" rows="4"></textarea>`, { error: false })}</div>
          <div class="span-2 field">
            <div class="check"><input id="consent" name="consent" type="checkbox" required data-validate ${desc('consent')}><label for="consent" style="font-weight:400">I agree that Learn UK can contact me about my enquiry. We will not share your details. <span class="visually-hidden">(required)</span></label></div>
            <p class="error" id="consent-error">${icon('info', 'style="width:1rem;height:1rem;flex:none"')}<span></span></p>
          </div>
        </div>
        <div style="margin-top:var(--space-4)"><button class="btn" type="submit"><span data-label>Send enquiry</span> ${icon('arrow')}</button></div>
      </form>
      <div class="success" data-success hidden>
        <div class="tick">${icon('check')}</div>
        <h2 tabindex="-1">Thank you, <span data-first-name></span></h2>
        <p>Your enquiry is ready. An adviser will be in touch to arrange your consultation.</p>
        <p class="sample-note" style="text-align:left">${icon('info')}<span><strong>Preview only:</strong> this form is not connected yet, so the enquiry was not sent.</span></p>
        <button class="btn btn--ghost" type="button" data-reset-enquiry>Send another enquiry</button>
      </div>
    </div>
    <aside class="panel" aria-labelledby="expect-title" style="background:var(--navy);color:var(--white);border-color:var(--navy)">
      <div class="on-dark">
        <h2 id="expect-title" style="font-size:var(--step-2);color:var(--white)">What happens next</h2>
        <ul class="list-check" style="color:var(--on-dark-soft)">
          <li>${icon('check')}<span>An adviser reviews your enquiry and contacts you to arrange a time.</span></li>
          <li>${icon('check')}<span>Your consultation is free, online or by phone, with no obligation.</span></li>
          <li>${icon('check')}<span>You leave with a clear plan and a shortlist to explore.</span></li>
        </ul>
        <hr style="border:0;border-top:1px solid rgb(255 255 255 / .15);margin:var(--space-4) 0">
        <p style="margin:0 0 .3rem;color:var(--white);font-weight:600">Prefer to email?</p>
        <p style="margin:0"><a href="mailto:hello@learnuk.example" style="color:var(--amber)">hello@learnuk.example</a> <span style="color:var(--on-dark-soft);font-size:.85rem">(placeholder)</span></p>
      </div>
    </aside>
  </div>
</section>` });

/* ---------- Write ---------- */
async function main() {
  rmSync(OUT, { recursive: true, force: true });
  for (const d of ['assets/css', 'assets/js', 'assets/fonts', 'assets/img', 'data']) mkdirSync(OUT + d, { recursive: true });

  await build({ entryPoints: [SRC + 'js/main.js'], outdir: OUT + 'assets/js', bundle: true, splitting: true, format: 'esm', minify: true, target: ['es2020', 'safari15'], chunkNames: 'chunks/[name]-[hash]', legalComments: 'none' });
  await build({ entryPoints: [SRC + 'css/site.css'], outfile: OUT + 'assets/css/site.css', minify: true, target: ['safari15', 'chrome110', 'firefox110'] });

  ASSET_V = createHash('sha1').update(readFileSync(OUT + 'assets/css/site.css')).update(readFileSync(OUT + 'assets/js/main.js')).digest('hex').slice(0, 8);

  copyFileSync(ROOT + 'node_modules/@fontsource-variable/urbanist/files/urbanist-latin-wght-normal.woff2', OUT + 'assets/fonts/urbanist-latin-wght.woff2');
  copyFileSync(ROOT + 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', OUT + 'assets/fonts/inter-latin-wght.woff2');
  for (const f of ['learn-uk-wordmark-white.svg', 'learn-uk-wordmark-royal-blue.svg', 'learn-uk-favicon.svg']) copyFileSync(LOGO + f, OUT + 'assets/img/' + f);
  if (existsSync(ROOT + 'static/img')) for (const f of readdirSync(ROOT + 'static/img')) copyFileSync(ROOT + 'static/img/' + f, OUT + 'assets/img/' + f);
  copyFileSync(SRC + 'data/universities.json', OUT + 'data/universities.json');
  copyFileSync(SRC + 'data/courses.json', OUT + 'data/courses.json');

  for (const p of pages) writeFileSync(OUT + p.file, page(p));
  console.log('Built', pages.length, 'pages to dist/');
}
main();
