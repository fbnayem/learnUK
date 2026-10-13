// Static site generator for Learn UK. `node src/build.mjs` writes dist/.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, existsSync, readdirSync, cpSync } from 'node:fs';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = ROOT + 'src/';
const OUT = ROOT + 'dist/';
const LOGO = ROOT + 'static/logo/';

const { universities, meta: dataMeta } = JSON.parse(readFileSync(SRC + 'data/universities.json'));
const courseData = JSON.parse(readFileSync(SRC + 'data/courses.json'));
// Scene photo for each university card (a typical setting, not the campus itself).
const UNI_IMAGES = JSON.parse(readFileSync(SRC + 'data/uni-images.json'));
const uniImage = (u) => UNI_IMAGES[u.slug] || ({ Scotland: 'uni-scotland-1', Wales: 'uni-wales', 'Northern Ireland': 'uni-ni' })[u.nation] || 'uni-city-1';
// Corrections to the source data: current official names, and clearer locations. Applied on every build, so the weekly data refresh keeps them.
const UNI_FIX = {
  'The University of East London Higher Education Corporation': { name: 'University of East London' },
  'Oxford University': { name: 'University of Oxford' },
  'University of Lancaster': { name: 'Lancaster University' },
  'University of Northumbria at Newcastle': { name: 'Northumbria University' },
  'Roehampton University': { name: 'University of Roehampton' },
  'University of South Wales/Prifysgol De Cymru': { name: 'University of South Wales' },
  'Southampton Solent University': { name: 'Solent University' },
  'University of Wales: Trinity Saint David': { name: 'University of Wales Trinity Saint David' },
  'UWE, Bristol': { name: 'University of the West of England, Bristol' },
  'University of the Arts, London': { name: 'University of the Arts London' },
  'City, University of London': { name: 'City St George’s, University of London' },
  "Regent's University": { name: 'Regent’s University London' },
  'Richmond, The American International University in London': { name: 'Richmond American University London' },
  "St Mary's University College": { name: 'St Mary’s University College, Belfast' },
  'University of London institute in Paris': { name: 'University of London Institute in Paris', city: 'Paris, France', nation: '' },
  'Harper Adams University': { city: 'Newport, Shropshire' },
  'Ulster University': { city: 'Belfast, Coleraine and Derry~Londonderry' },
  'The University of Law': { city: 'London and other UK cities' },
};
for (const u of universities) {
  const fix = UNI_FIX[u.name];
  if (fix) Object.assign(u, { formerName: fix.name ? u.name : undefined }, fix);
  u.name = u.name.replace(/'/g, '’');
}
// Per-university facts from the course data: top subjects, placement years, years abroad, course lengths.
{
  const stats = universities.map(() => ({ subj: new Map(), placement: 0, abroad: 0, len: new Map() }));
  for (const c of courseData.courses) {
    const st = stats[c[1]]; if (!st) continue;
    for (const s of c[2]) st.subj.set(s, (st.subj.get(s) || 0) + 1);
    if (c[4]) st.placement++; if (c[5]) st.abroad++;
    if (c[3]) st.len.set(c[3], (st.len.get(c[3]) || 0) + 1);
  }
  universities.forEach((u, i) => {
    const st = stats[i];
    u.topSubjects = [...st.subj].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => courseData.subjects[s].replace(/ \(non-specific\)/, ''));
    u.subjectCount = st.subj.size; u.placement = st.placement; u.abroad = st.abroad;
  });
}
const { subjects } = courseData;
const courseTotal = courseData.courses.length;
const n = (x) => x.toLocaleString('en-GB');
const dataDate = new Date(dataMeta.updated + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const CONTACT = {
  email: 'info@learnuk.co.uk',
  mobile: { label: '07908 661821', tel: '+447908661821' },
  landline: { label: '020 8036 1199', tel: '+442080361199' },
  address: ['210 Olympic House', '28-42 Clements Road', 'Ilford, Essex', 'IG1 1BA'],
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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


// Responsive photo from static/img/photos (made by tools/gen-photos.mjs).
const PHOTO_W = { 'study-documents': [480, 800, 1200], card: [480, 800, 1200], default: [480, 800, 1200, 1536] };
const pic = (name, alt, sizes, { w = 1536, h = 1024, cls = '', eager = false } = {}) => {
  const ws = PHOTO_W[name] || (/^(why|service|uni)-/.test(name) ? PHOTO_W.card : PHOTO_W.default);
  const set = (ext) => ws.map((x) => `assets/img/photos/${name}-${x}.${ext} ${x}w`).join(', ');
  return `<picture class="photo ${cls}"><source type="image/avif" srcset="${set('avif')}" sizes="${sizes}"><source type="image/webp" srcset="${set('webp')}" sizes="${sizes}"><img src="assets/img/photos/${name}-800.jpg" width="${w}" height="${h}" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></picture>`;
};

/* ---------- Site chrome ---------- */
const NAV = [
  { href: 'index.html', label: 'Home' },
  { group: 'Study', items: [
    { href: 'universities.html', label: 'Universities', desc: 'Compare UK universities and cities' },
    { href: 'courses.html', label: 'Courses', desc: 'Search courses by subject and university' },
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
        <p>A UK-based educational consultancy helping students from the UK and around the world, from first question to first day at a UK university.</p>
      </div>
      <div><h2>Study</h2><ul><li><a href="universities.html">Universities</a></li><li><a href="courses.html">Courses</a></li><li><a href="application-journey.html">Application journey</a></li></ul></div>
      <div><h2>Learn UK</h2><ul><li><a href="services.html">Services</a></li><li><a href="about.html">About us</a></li><li><a href="faqs.html">FAQs</a></li><li><a href="contact.html">Contact</a></li></ul></div>
      <div><h2>Talk to us</h2><ul><li><a href="contact.html">Book a free consultation</a></li><li><a href="mailto:${CONTACT.email}">${CONTACT.email}</a></li><li><a href="tel:${CONTACT.landline.tel}">Office: ${CONTACT.landline.label}</a></li><li><a href="tel:${CONTACT.mobile.tel}">Mobile: ${CONTACT.mobile.label}</a></li></ul><address class="footer-address">${CONTACT.address.join('<br>')}</address></div>
    </div>
    <div class="footer-base"><span>© 2026 Learn UK. All rights reserved.</span><span class="footer-legal"><a href="privacy.html">Privacy policy</a><a href="terms.html">Terms of use</a><a href="cookies.html">Cookies</a><a href="accessibility.html">Accessibility</a><a href="complaints.html">Complaints</a></span></div>
  </div>
</footer>`;

let ASSET_V = '';
function page({ file, title, description, body, preloadHero = false }) {
  if (PAGE_FAQS[file] && file !== 'index.html') {
    const cta = '<section class="section"><div class="container"><div class="cta-band';
    const at = body.lastIndexOf(cta);
    body = at >= 0 ? body.slice(0, at) + faqSection(file) + '\n' + body.slice(at) : body + '\n' + faqSection(file);
  }
  const faqs = pageFaqItems(file);
  const ld = [ORG_LD, ...(faqs.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: strip(q), acceptedAnswer: { '@type': 'Answer', text: strip(a) } })) }] : [])].map(jsonLd).join('\n');
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
${ld}
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

const pageHero = (crumb, eyebrow, h1, lede, extra = '', img = null) => `<section class="page-hero on-dark${img ? ' page-hero--photo' : ''}">
  ${img ? `<div class="page-hero-media">${pic(img[0], '', '100vw', { eager: true })}</div>` : ''}
  <div class="container">
    <nav aria-label="Breadcrumb"><ol class="breadcrumb"><li><a href="index.html">Home</a></li><li aria-current="page">${crumb}</li></ol></nav>
    <p class="eyebrow">${eyebrow}</p>
    <h1>${h1}</h1>
    <p class="lede">${lede}</p>${extra}
  </div>
</section>`;

const sourceNote = (what) => `<p class="source-note">${icon('info')}<span>${what} Source: Discover Uni (Office for Students, HESA and the UK funding bodies), Open Government Licence v3.0, with university websites and locations from Wikidata. Updated ${dataDate}. Always check the details on the university’s own website before applying.</span></p>`;

const ctaBand = (h = 'Not sure where to start?', p = 'Book a free consultation. We will talk through your goals, your grades and your budget, then suggest a shortlist that fits.') => `<section class="section"><div class="container"><div class="cta-band reveal">
  <div><h2>${h}</h2><p>${p}</p></div>
  <div><a class="btn btn--amber" href="contact.html">Book a free consultation ${icon('arrow')}</a></div>
</div></div></section>`;

/* ---------- Shared content ---------- */
const SERVICES = [
  ['compass', 'Course and university matching', 'We shortlist courses that fit your grades, goals, budget and preferred city, and explain the trade-offs honestly.'],
  ['doc', 'Application support', 'Help with UCAS and direct applications, references and the documents universities ask for.'],
  ['chat', 'English language guidance', 'Which English tests your chosen universities accept, the scores they ask for, and how to prepare.'],
  ['pound', 'Scholarships and budgeting', 'Find scholarships you can apply for and plan a realistic budget for fees and living costs.'],
  ['passport', 'Student visa guidance', 'A clear checklist for your CAS, financial evidence and visa documents, so nothing holds up your application.'],
  ['plane', 'Pre-departure and arrival', 'Accommodation options, what to pack, and what to do in your first week in the UK.'],
];

const WHY_PHOTOS = [
  ['why-consultation', 'A student smiling as she introduces herself to an adviser at a small table'],
  ['why-support', 'An adviser shaking hands with a student arriving at the airport with his suitcase'],
  ['why-honest', 'An adviser explaining something openly to a student across a desk'],
  ['why-data', 'A student comparing two university course pages side by side on a laptop'],
  ['why-funding', 'A student planning his budget with a notebook and calculator'],
  ['why-team', 'An adviser welcoming a student into a bright office reception'],
];
const SERVICE_PHOTOS = [
  ['service-matching', 'A student and adviser comparing university brochures on a table'],
  ['service-applications', 'Hands sorting certificates and application documents into a folder'],
  ['service-english', 'A student wearing headphones practising for a speaking test on her laptop'],
  ['service-scholarships', 'A student celebrating good news in a letter as his mother smiles'],
  ['service-visa', 'A passport beside a visa document checklist being ticked off'],
  ['service-arrival', 'A student packing a warm coat into her suitcase for the UK'],
];
const cardPic = ([name, alt]) => `<div class="feature-media">${pic(name, alt, '(min-width: 64em) 23rem, (min-width: 48em) 45vw, 92vw')}</div>`;
const WHY_US = [
  ['heart', 'Free first consultation', 'Talk through your options with an adviser at no cost, and get honest advice before you commit to anything.'],
  ['chat', 'Support from start to finish', 'We stay with you from your first question to your first week, so you always know what comes next and who to ask.'],
  ['shield', 'Honest, student-first advice', 'We recommend courses that suit your grades, goals and budget, and we tell you plainly when something is not the right fit.'],
  ['compass', 'Advice based on official data', `Our course search covers ${n(universities.length)} UK universities and ${n(courseTotal)} courses from official Discover Uni data, refreshed every week.`],
  ['pound', 'Help with funding', 'We help you find scholarships you can apply for and plan a realistic budget for tuition fees and living costs.'],
  ['pin', 'A UK-based team', 'Our office is in Ilford, east London, so your advice comes from people who know UK universities and student life first hand.'],
]

const JOURNEY = [
  ['Free consultation', 'Tell us what you want to study and where you are now. We explain your options and what each route involves.', 'Week 1'],
  ['Shortlist courses', 'We match you with courses and universities that fit your grades, budget and goals, and check entry requirements.', 'Weeks 1–3'],
  ['Apply', 'Write your personal statement and gather your documents, then apply through UCAS (undergraduate) or directly to universities (postgraduate).', 'Months before your intake'],
  ['Accept your offer', 'Meet any conditions, accept your offer and pay your deposit. Your university then issues your CAS.', 'After your offer'],
  ['Student visa', 'Use our checklist to gather your documents and complete your visa application with confidence.', 'Up to 6 months before your course'],
  ['Arrive in the UK', 'Pre-departure briefing, accommodation help and support through your first weeks on campus.', 'Your first term'],
];

const FAQS = [
  { group: 'Getting started', items: [
    ['Is the first consultation really free?', 'Yes. Your first consultation is free and there is no obligation to use our services afterwards. We will tell you upfront if any later service has a cost.'],
    ['When should I start planning?', 'Ideally 9 to 12 months before your course starts. There are intakes all year round. Starting early gives you time for English tests, applications and your visa.'],
    ['Can you help if I have not chosen a subject yet?', 'Yes. We will talk through your interests, strengths and career plans and show you how different courses lead to different options.'],
  ] },
  { group: 'Applications', items: [
    ['How do I apply for an undergraduate course?', 'Most undergraduate applications go through UCAS, the UK’s central admissions service. We help you choose your courses and check your application and documents before you submit.'],
    ['How do postgraduate applications work?', 'Most postgraduate applications go directly to each university. Requirements vary, so we check what each course asks for and help you prepare your documents.'],
    ['Do I need an English test?', 'Usually, unless you are from a majority English-speaking country or meet a university’s exemption rules. Universities set their own accepted tests and scores, and we will check them for each course on your shortlist.'],
  ] },
  { group: 'Costs and funding', items: [
    ['How much does it cost to study in the UK?', 'Tuition fees for international students vary widely by university, subject and level. You also need to budget for living costs, which depend on the city. We help you build a realistic budget for your shortlist.'],
    ['Are there scholarships for international students?', 'Many universities offer scholarships or fee discounts, and there are government and external schemes too. We help you find the ones you are eligible for and meet their deadlines.'],
  ] },
  { group: 'Visas and arrival', items: [
    ['Can you apply for my visa for me?', 'You make your own Student visa application. We give you a clear checklist and help you understand what each document is for. Always check the latest rules on GOV.UK.'],
    ['What is a CAS?', 'A Confirmation of Acceptance for Studies (CAS) is a reference number your university gives you once you have accepted an unconditional offer. You need it to apply for your Student visa.'],
    ['Will you help me find accommodation?', 'Yes. We explain the options, from university halls to private housing, and help you apply before you travel.'],
    ['How much money do I need to show for my visa?', 'You need to show you can pay your course fees and a set amount for living costs for up to nine months. The monthly amount is higher if you study in London. Check the current figures on GOV.UK.'],
    ['Do I need to pay for healthcare?', 'Most students pay the Immigration Health Surcharge as part of their visa application. It gives you access to the NHS while you study.'],
  ] },
  { group: 'Studying and living in the UK', items: [
    ['How long does a UK degree take?', 'Most undergraduate degrees take three years in England, Wales and Northern Ireland, and four years in Scotland. Most taught master’s degrees take one year.'],
    ['When do UK courses start?', 'There are intakes all year round. Start dates depend on the course, so an adviser will confirm the options for the course you choose.'],
    ['Can I work while I study?', 'Most students on a Student visa studying at degree level can work up to 20 hours a week during term time and full time in the holidays. Your visa sets your exact limit, so check it before you take a job.'],
    ['Can I stay in the UK after I graduate?', 'The Graduate route lets eligible students stay and work in the UK for a period after finishing their degree. The rules and length can change, so check GOV.UK for the current terms.'],
    ['Can I bring my family?', 'Most students on taught courses, including most master’s courses, cannot bring family members as dependants. Some research postgraduate students can. Check the latest rules on GOV.UK.'],
    ['Is the UK safe for international students?', 'UK university cities are generally welcoming to international students, and universities offer support services, from welcome weeks to student advice teams. We help you get to know your city before you arrive.'],
  ] },
];

// FAQs shown near the foot of each page, also published as FAQPage structured data.
const PAGE_FAQS = {
  'index.html': { title: 'Questions students often ask', items: [
    ['What does Learn UK do?', 'Learn UK is a UK-based educational consultancy for students who want to study at a UK university. We help you choose a course and university, apply, prepare your Student visa documents and get ready to arrive.'],
    FAQS[0].items[0], FAQS[0].items[1], FAQS[1].items[0],
    ['Where is Learn UK based?', `Learn UK is a UK-based educational consultancy. Our office is at ${CONTACT.address.join(', ')}, and we help students from the UK and around the world.`],
    FAQS[3].items[1],
  ] },
  'universities.html': { title: 'Questions about UK universities', items: [
    ['How many universities are listed here?', `We list ${universities.length} UK universities that offer full-time undergraduate courses, across England, Scotland, Wales and Northern Ireland. The list comes from Discover Uni, the official UK site for comparing courses, and is refreshed every week.`],
    ['How do I choose the right UK university?', 'Start with the course, not the name. Compare entry requirements, how the course is taught and assessed, placement and study abroad options, the city and your budget. An adviser can help you weigh these for your own grades and goals.'],
    ['Is a degree in Scotland different?', 'Most undergraduate degrees in Scotland take four years, compared with three years in England, Wales and Northern Ireland. The first year is broader, and some students with strong qualifications can join in the second year.'],
    ['What is the Russell Group?', 'The Russell Group is an association of 24 research-intensive UK universities. Many excellent universities are not members, so membership is only one thing to consider when you choose.'],
    ['Can I apply to more than one university?', 'Yes. Through UCAS you can apply for up to five undergraduate courses in one application, at the same or different universities.'],
  ] },
  'courses.html': { title: 'Questions about UK courses', items: [
    ['How many courses can I search here?', `${n(courseTotal)} full-time undergraduate courses at UK universities, taken from official Discover Uni data and refreshed every week.`],
    ['Are postgraduate courses included?', 'No. This search covers full-time undergraduate courses only. Postgraduate, foundation and pathway courses are not listed, but our advisers can search them with you.'],
    ['What is a placement year?', 'A placement or sandwich year is a year working in industry, usually between your second and final year. It adds a year to your degree and can make a big difference to your career prospects.'],
    ['What does a year abroad mean?', 'Some courses include a year studying at a partner university in another country. Tick Year abroad available in the search to find these courses. Each course card shows whether the year abroad is optional or compulsory.'],
    ['How do I ask about a course?', 'Select Enquire on any course and tell us a little about yourself. An adviser will check the entry requirements and help you decide whether to apply.'],
  ] },
  'application-journey.html': { title: 'Questions about applying', items: [
    ['How long does the whole process take?', 'Most students start 9 to 12 months before their course. That leaves time to choose courses, take an English test if needed, apply, meet your offer conditions and get your visa.'],
    ['What are the UCAS deadlines?', 'Applications for Oxford, Cambridge and most medicine, dentistry and veterinary courses close in mid-October, the year before you start. The main deadline for most other courses is in January. Many universities accept international applications later, but popular courses can fill up.'],
    ['What is the difference between a conditional and an unconditional offer?', 'A conditional offer means you still need to meet requirements, such as final grades or an English test score. An unconditional offer means you have a place once you accept it.'],
    ['When can I apply for my Student visa?', 'Once your university gives you a CAS. You can apply up to six months before your course starts if you are outside the UK. Check the current rules on GOV.UK before you apply.'],
    ['When should I travel to the UK?', 'Your visa sets the earliest date you can arrive, usually up to a week before a short course or up to a month before a longer one. Plan to arrive before your university’s welcome week.'],
  ] },
  'services.html': { title: 'Questions about our services', items: [
    FAQS[0].items[0],
    ['Do you help with university applications?', 'Yes. We help you choose your courses, check the entry requirements and make sure your application and documents are complete before you submit.'],
    ['Do you help with Student visa applications?', 'We give you a clear checklist, explain each document and check you have everything before you apply. You submit the application yourself.'],
    ['Can you help me find scholarships?', 'Yes. We look for scholarships and fee discounts you are eligible for at the universities on your shortlist, and help you meet their deadlines.'],
    ['Do you help students outside the UK?', 'Yes. We help students in the UK and around the world. Consultations can happen by phone or video call, so you can work with us wherever you live.'],
  ] },
  'about.html': { title: 'Questions about Learn UK', items: [
    ['Who is Learn UK?', 'Learn UK is a UK-based educational consultancy. We help students from the UK and around the world choose, apply for and start the right course at a UK university.'],
    ['Where is your office?', `Our office is at ${CONTACT.address.join(', ')}.`],
    ['How can I contact you?', `Email ${CONTACT.email}, call our office on ${CONTACT.landline.label} or our mobile on ${CONTACT.mobile.label}, or book a free consultation online.`],
    ['How do you choose which courses to recommend?', 'We start from your grades, goals, budget and preferred city, and use official course data to build a shortlist. We explain the trade-offs honestly, including when a course is not the right fit.'],
  ] },
  'contact.html': { title: 'Before you book', items: [
    ['Is the consultation online or in person?', 'Your free consultation is online or by phone, so you can join from anywhere.'],
    ['What should I have ready for my consultation?', 'Your latest grades or transcripts, any English test results, the subjects you are interested in and a rough idea of your budget. It is fine if you are not sure about some of these yet.'],
    ['Can I call instead of filling in the form?', `Yes. Call our office on ${CONTACT.landline.label}, our mobile on ${CONTACT.mobile.label}, or email ${CONTACT.email}.`],
    ['Do I have to use your services after the consultation?', 'No. The first consultation is free and there is no obligation to continue.'],
  ] },
};
const faqSection = (file) => {
  const f = PAGE_FAQS[file];
  return `<section class="section" aria-labelledby="page-faq-title">
  <div class="container split">
    <div class="reveal"><p class="eyebrow">FAQs</p><h2 id="page-faq-title">${f.title}</h2><p class="lede">Can’t find your answer? Ask us in a free consultation.</p><a class="text-link" href="faqs.html">All FAQs ${icon('arrow')}</a></div>
    <div class="reveal">${faqList(f.items)}</div>
  </div>
</section>`;
};
const strip = (h) => h.replace(/<[^>]+>/g, '');
const pageFaqItems = (file) => file === 'faqs.html' ? FAQS.flatMap((g) => g.items) : (PAGE_FAQS[file]?.items || []);
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const ORG_LD = { '@context': 'https://schema.org', '@type': 'EducationalOrganization', name: 'Learn UK', description: 'UK-based educational consultancy helping students from the UK and around the world study at UK universities: course matching, applications, Student visa guidance and arrival support.', email: CONTACT.email, telephone: CONTACT.landline.tel, address: { '@type': 'PostalAddress', streetAddress: '210 Olympic House, 28-42 Clements Road', addressLocality: 'Ilford', addressRegion: 'Essex', postalCode: 'IG1 1BA', addressCountry: 'GB' } };

const faqList = (items, open = false) => `<div class="faq">${items.map(([q, a], i) => `<details${open && i === 0 ? ' open' : ''}><summary><span class="q">${q}</span><span class="chev">${icon('chevron')}</span></summary><div class="answer"><p>${a}</p></div></details>`).join('')}</div>`;

const initials = (name) => name.replace(/^the\s+/i, '').replace(/\b(of|and|the|for|in|at|&)\b/gi, ' ').split(/[\s,'’-]+/).filter(Boolean).slice(0, 3).map((w) => w[0].toUpperCase()).join('');
const CHOOSE = [
  ['compass', 'Start with the course', 'Two courses with the same name can be very different. Compare the modules, how you are assessed and whether there is a placement year or a year abroad.'],
  ['cap', 'Check the entry requirements', 'Look at the grades, subjects and English test scores each course asks for, and make sure your qualifications are accepted.'],
  ['pound', 'Plan the full cost', 'Add up tuition fees, rent and living costs. Costs are higher in London, and fees for international students vary a lot between universities.'],
  ['pin', 'Think about the city', 'Big city or campus town, near family or somewhere new. Where you live for three or four years matters as much as the university.'],
  ['heart', 'Look at student support', 'Check the help on offer for international students, accommodation guarantees for first-year students, and careers support.'],
  ['chat', 'Get a second opinion', 'An adviser can check your shortlist against your grades and budget and point out options you may have missed.'],
];
const NATIONS = [
  ['England', 'Most UK universities are in England, from large city universities to specialist arts and music schools. Most bachelor’s degrees take three years, and many offer a placement year or a foundation year.'],
  ['Scotland', 'A Scottish honours degree usually takes four years, with a broader first year so you can try more than one subject. Scotland has four of the UK’s oldest universities: St Andrews, Glasgow, Aberdeen and Edinburgh.'],
  ['Wales', 'Welsh universities offer degrees in English, and some courses can also be studied partly or fully in Welsh. Most bachelor’s degrees take three years.'],
  ['Northern Ireland', 'Northern Ireland has two universities, Queen’s University Belfast and Ulster University, and two university colleges for teacher education. Most bachelor’s degrees take three years.'],
];
const uniCard = (u, i = 0) => `<article class="card uni-card reveal" style="--i:${i % 3}" data-tilt data-item data-nation="${esc(u.nation || '')}" data-search="${esc([u.name, u.formerName, u.city, u.nation, ...u.topSubjects].filter(Boolean).join(' '))}">
  <div class="card-media uni-media">${pic(uniImage(u), '', '(min-width: 64em) 23rem, (min-width: 48em) 45vw, 92vw')}</div>
  <div class="card-body">
    <div class="uni-head"><span class="monogram" aria-hidden="true">${esc(initials(u.name))}</span><div><h3><a class="card-link" href="courses.html?university=${u.slug}">${esc(u.name)}</a></h3>
    <p>${icon('pin', 'style="width:1em;height:1em;display:inline;vertical-align:-.125em;margin-right:.25rem"')}${esc([u.city, u.nation].filter(Boolean).join(', '))}</p></div></div>
    <ul class="meta">${u.nation ? `<li class="tag tag--royal">${esc(u.nation)}</li>` : ''}${u.subjectCount > 1 ? `<li class="tag">${u.subjectCount} subject areas</li>` : ''}${u.placement ? `<li class="tag">${n(u.placement)} with a placement year</li>` : ''}${u.abroad ? `<li class="tag">${n(u.abroad)} with a year abroad</li>` : ''}</ul>
    ${u.topSubjects.length ? `<p class="uni-subjects"><span>${u.topSubjects.length > 1 ? 'Most courses in' : 'Courses in'}</span> ${esc(u.topSubjects.join(', '))}</p>` : ''}
    <div class="card-foot"><span><strong>${n(u.courseCount)}</strong> full-time undergraduate ${u.courseCount === 1 ? 'course' : 'courses'}</span></div>
  </div>
</article>`;

const options = (list, all) => `<option value="">${all}</option>` + list.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
const nations = ['England', 'Scotland', 'Wales', 'Northern Ireland'].filter((x) => universities.some((u) => u.nation === x));
// Home page: a spread across the four nations, falling back to the largest universities.
const FEATURED = [/^the university of manchester$/i, /^university of leeds$/i, /^university of birmingham$/i, /^university of glasgow$/i, /^cardiff university$/i, /^queen'?s university belfast$/i];
const featured = (() => {
  const picks = FEATURED.map((re) => universities.find((u) => re.test(u.name))).filter(Boolean);
  for (const u of [...universities].sort((a, b) => b.courseCount - a.courseCount)) { if (picks.length >= 6) break; if (!picks.includes(u)) picks.push(u); }
  return picks.slice(0, 6);
})();

/* ---------- Pages ---------- */
const pages = [];

pages.push({ file: 'index.html', title: 'Home', preloadHero: true,
  description: 'Learn UK helps international students find, apply for and start the right course at a UK university. Book a free consultation.',
  body: `<section class="hero on-dark" aria-labelledby="hero-title">
  <div class="container hero-inner">
    <div class="hero-copy">
      <div class="hero-intro">
        <p class="eyebrow hero-anim" data-d="1">UK university admissions support</p>
        <h1 id="hero-title">Your journey to a <em>UK university</em> starts here</h1>
        <p class="lede hero-anim" data-d="1">Wherever you are in the world, we help you choose the right course, apply with confidence and arrive ready to start.</p>
      </div>
      <div class="search-card hero-anim" data-d="2">
        <form data-lead novalidate aria-labelledby="lead-title" action="#" method="post">
          <p class="search-title" id="lead-title">Get a free call back</p>
          <p class="lead-hint" id="lead-hint">Leave your details and an adviser will contact you. See our <a href="privacy.html">privacy policy</a>.</p>
          <p class="lead-error" data-lead-error role="alert" tabindex="-1" hidden>Sorry, your request did not send. Please try again, or call <a href="tel:${CONTACT.landline.tel}">${CONTACT.landline.label}</a>.</p>
          <div class="search-grid">
            <div class="field">
              <label for="lead-phone">Phone or WhatsApp</label>
              <input class="input" id="lead-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" pattern="[+0-9 ()-]{7,20}" placeholder="+44 7700 900123" required aria-describedby="lead-hint lead-phone-error">
              <p class="error" id="lead-phone-error">${icon('info', 'style="width:1rem;height:1rem;flex:none"')}<span>Enter a phone number with your country code, like +44 7700 900123</span></p>
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
          <div><p class="search-title">Thanks, we will be in touch</p><p class="lead-hint">An adviser will contact you soon.</p></div>
        </div>
      </div>
      <div class="hero-actions hero-anim" data-d="3">
        <a class="btn btn--amber" href="contact.html">Book a free consultation ${icon('arrow')}</a>
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
    <div class="why-photo reveal">${pic('campus-students', 'Three international students walking and talking on a UK university campus in autumn', '(min-width: 75em) 70rem, 94vw')}</div>
    <dl class="stats">
      <div class="stat reveal" style="--i:0"><dt>for most undergraduate degrees in England, Wales and Northern Ireland</dt><dd>3 years</dd></div>
      <div class="stat reveal" style="--i:1"><dt>for most taught master’s degrees</dt><dd>1 year</dd></div>
      <div class="stat reveal" style="--i:2"><dt>All year round intakes</dt><dd>Any time</dd></div>
    </dl>
    <div class="why-us">
      <div class="why-us-head reveal"><h3 id="why-us-title">Why students choose Learn UK</h3><p>Studying abroad is a big decision. Here is what you get when you work with us.</p></div>
      <div class="grid grid--3" role="list" aria-labelledby="why-us-title">${WHY_US.map(([ic, h, p], i) => `<div class="feature feature--photo reveal" role="listitem" style="--i:${i % 3}">${cardPic(WHY_PHOTOS[i])}<div class="icon-tile">${icon(ic)}</div><h4>${h}</h4><p>${p}</p></div>`).join('')}</div>
      <div class="why-us-cta reveal"><a class="btn" href="contact.html">Book a free consultation ${icon('arrow')}</a></div>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="services-title">
  <div class="container">
    <div class="section-head reveal"><div><p class="eyebrow">How we help</p><h2 id="services-title">Support at every step</h2><p>One team to guide you from your first question to your first lecture.</p></div><a class="text-link" href="services.html">All services ${icon('arrow')}</a></div>
    <div class="grid grid--3">${SERVICES.map(([ic, h, p], i) => `<div class="feature feature--photo reveal" style="--i:${i % 3}">${cardPic(SERVICE_PHOTOS[i])}<div class="icon-tile">${icon(ic)}</div><h3>${h}</h3><p>${p}</p></div>`).join('')}</div>
  </div>
</section>

<section class="section section--mist" aria-labelledby="unis-title">
  <div class="container">
    <div class="section-head reveal"><div><p class="eyebrow">Universities</p><h2 id="unis-title">Explore universities across the UK</h2><p>${n(universities.length)} universities and ${n(courseTotal)} full-time undergraduate courses, in England, Scotland, Wales and Northern Ireland.</p></div><a class="text-link" href="universities.html">All universities ${icon('arrow')}</a></div>
    <div class="grid grid--3">${featured.map(uniCard).join('')}</div>
  </div>
</section>

<section class="section" aria-labelledby="journey-title">
  <div class="container">
    <div class="section-head reveal"><div><p class="eyebrow">The application journey</p><h2 id="journey-title">Six steps from enquiry to arrival</h2><p>We stay with you through every stage, so you always know what comes next.</p></div><a class="text-link" href="application-journey.html">See the full journey ${icon('arrow')}</a></div>
    <ol class="journey journey--row">${JOURNEY.map(([h, p]) => `<li class="journey-step"><span class="journey-num" aria-hidden="true"></span><div><h3>${h}</h3><p>${p}</p></div></li>`).join('')}</ol>
  </div>
</section>


${faqSection('index.html')}
${ctaBand()}` });

pages.push({ file: 'universities.html', title: 'Universities', description: `Explore all ${universities.length} UK universities by nation and city, with official course data from Discover Uni.`,
  body: `${pageHero('Universities', 'Study', 'Find a UK university that fits you', 'Compare universities across England, Scotland, Wales and Northern Ireland, then explore their courses.', '', ['university-quad'])}
<section class="section section--mist">
  <div class="container">
    ${sourceNote(`${n(universities.length)} UK universities offering full-time undergraduate courses.`)}
    <form class="filters filters--2" data-filter-form data-noun="universities" aria-label="Filter universities">
      <div class="field"><label for="f-q">Search</label><input class="input" id="f-q" name="q" type="search" placeholder="University or city" autocomplete="off"></div>
      <div class="field"><label for="f-nation">Nation</label><select class="select" id="f-nation" name="nation">${options(nations, 'All nations')}</select></div>
    </form>
    <div data-results-region>
      <div class="results-bar"><p class="results-count" role="status" aria-live="polite"><span class="spinner" aria-hidden="true"></span><span data-count>${universities.length} universities found</span></p></div>
      <h2 class="visually-hidden">Universities</h2>
      <div class="grid grid--3 results">${universities.map(uniCard).join('')}</div>
      <p class="photo-note">Card photos show typical student life in each kind of setting. They are not photos of the universities themselves.</p>
      <div class="empty-state" data-empty hidden><p><strong>No universities match those filters.</strong></p><p>Try a different city or clear a filter. Or <a href="contact.html">ask an adviser</a> to suggest options.</p></div>
    </div>
  </div>
</section>
<section class="section" aria-labelledby="choose-title">
  <div class="container">
    <div class="section-head reveal"><div><p class="eyebrow">Choosing a university</p><h2 id="choose-title">How to choose the right UK university</h2><p>Rankings are only part of the picture. These are the questions we work through with every student.</p></div></div>
    <div class="grid grid--3">${CHOOSE.map(([ic, h, p], i) => `<div class="feature reveal" style="--i:${i % 3}"><div class="icon-tile">${icon(ic)}</div><h3>${h}</h3><p>${p}</p></div>`).join('')}</div>
  </div>
</section>
<section class="section section--mist" aria-labelledby="nations-title">
  <div class="container">
    <div class="section-head reveal"><div><p class="eyebrow">Across the UK</p><h2 id="nations-title">Studying in England, Scotland, Wales and Northern Ireland</h2><p>The UK has four nations, and each has its own higher education system. Here is what changes from one to the next.</p></div></div>
    <div class="grid grid--2">${NATIONS.map(([nat, p], i) => `<div class="feature reveal" style="--i:${i % 2}"><h3>${nat} <span class="nation-count">${universities.filter((u) => u.nation === nat).length} listed</span></h3><p>${p}</p></div>`).join('')}</div>
  </div>
</section>
${ctaBand('Want help choosing?', 'An adviser can shortlist universities for your subject, grades and budget.')}` });

pages.push({ file: 'courses.html', title: 'Courses', description: `Search ${n(courseTotal)} full-time undergraduate courses at UK universities, from official Discover Uni data.`,
  body: `${pageHero('Courses', 'Study', 'Search UK courses', `Every full-time undergraduate course at UK universities listed on Discover Uni: ${n(courseTotal)} courses. Filter by subject, university and nation.`, '', ['library'])}
<section class="section section--mist">
  <div class="container">
    <form class="filters" data-course-search data-filter-form-courses aria-label="Filter courses" action="courses.html" method="get">
      <div class="field"><label for="c-q">Search</label><input class="input" id="c-q" name="q" type="search" placeholder="For example, computer science" autocomplete="off" enterkeyhint="search"></div>
      <div class="field"><label for="c-subject">Subject</label><select class="select" id="c-subject" name="subject">${options(subjects, 'All subjects')}</select></div>
      <div class="field"><label for="c-uni">University</label><select class="select" id="c-uni" name="university"><option value="">All universities</option>${universities.map((u) => `<option value="${u.slug}">${esc(u.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="c-nation">Nation</label><select class="select" id="c-nation" name="nation">${options(nations, 'All nations')}</select></div>
      <div class="field field--check"><label class="check"><input type="checkbox" name="placement" value="1"> Placement year available</label><label class="check"><input type="checkbox" name="abroad" value="1"> Year abroad available</label></div>
    </form>
    <div data-results-region class="is-fetching" aria-busy="true">
      <div class="results-bar"><p class="results-count" role="status" aria-live="polite"><span class="spinner" aria-hidden="true"></span><span data-count>Loading ${n(courseTotal)} courses…</span></p><button class="btn btn--ghost" type="button" data-clear>Clear filters</button></div>
      <h2 class="visually-hidden">Courses</h2>
      <div class="course-row results" data-course-results></div>
      <noscript><p class="empty-state">The course search needs JavaScript. You can browse <a href="universities.html">universities</a> instead, or <a href="contact.html">ask an adviser</a>.</p></noscript>
      <div class="more-row"><button class="btn btn--ghost" type="button" data-more hidden>Show more courses</button></div>
      <div class="empty-state" data-empty hidden><p><strong>No courses match those filters.</strong></p><p>Try a broader search or clear a filter. Or <a href="contact.html">ask an adviser</a> about courses not listed here.</p></div>
      <div class="empty-state" data-load-error hidden><p><strong>The course list did not load.</strong></p><p>Check your connection and <a href="courses.html">try again</a>, or <a href="contact.html">ask an adviser</a>.</p></div>
    </div>
    ${sourceNote('Full-time undergraduate courses only. Postgraduate courses are not in this official dataset; ask an adviser and we will search them with you.')}
  </div>
</section>
${ctaBand('Can’t see your course?', 'Postgraduate, foundation and pathway courses are not in this list. Our advisers can search them with you.')}` });

pages.push({ file: 'application-journey.html', title: 'Application journey', description: 'The six steps from your first enquiry to arriving at a UK university, and how Learn UK supports each one.',
  body: `${pageHero('Application journey', 'How it works', 'From first question to first lecture', 'Six clear steps, with an adviser beside you for each one. Scroll to follow the journey.', '', ['arrival'])}
<section class="section">
  <div class="container" style="max-width:52rem">
    <div class="journey-wrap"><span class="journey-progress" aria-hidden="true"></span>
    <ol class="journey">${JOURNEY.map(([h, p, when]) => `<li class="journey-step"><span class="journey-num" aria-hidden="true"></span><div><p class="when">${when}</p><h2 style="font-size:var(--step-2)">${h}</h2><p>${p}</p></div></li>`).join('')}</ol></div>
    <p class="sample-note" style="margin-top:var(--space-4)">${icon('info')}<span>Timings are typical and vary by course, university and nationality. Visa rules change, so always check the current requirements on GOV.UK.</span></p>
  </div>
</section>
${ctaBand('Ready for step one?', 'Your free consultation is the start of the journey. Tell us about your plans and we will map out the rest.')}` });

pages.push({ file: 'services.html', title: 'Services', description: 'Course matching, application support, English test guidance, scholarships, visa guidance and arrival support for international students.',
  body: `${pageHero('Services', 'Services', 'Everything you need to study in the UK', 'Practical, honest guidance at every stage, so you can make decisions with confidence.')}
<section class="section">
  <div class="container">
    <div class="grid grid--3">${SERVICES.map(([ic, h, p], i) => `<div class="feature feature--photo reveal" style="--i:${i % 3}">${cardPic(SERVICE_PHOTOS[i])}<div class="icon-tile">${icon(ic)}</div><h2 style="font-size:var(--step-1)">${h}</h2><p>${p}</p></div>`).join('')}</div>
  </div>
</section>
<section class="section section--mist">
  <div class="container split">
    <div class="stack-photos reveal">${pic('family-adviser', 'An adviser showing a student and her mother course options on a laptop', '(min-width: 64em) 36rem, 92vw')}${pic('study-documents', 'A student sorting application documents next to a passport and pen', '(min-width: 64em) 19rem, 48vw', { w: 1254, h: 1254 })}</div>
    <div class="reveal">
      <p class="eyebrow">What to expect</p>
      <h2>A plan that fits you, not a sales pitch</h2>
      <ul class="list-check">
        <li>${icon('check')}<span>A named adviser who knows your application.</span></li>
        <li>${icon('check')}<span>Clear checklists and deadlines for every step.</span></li>
        <li>${icon('check')}<span>Straight answers about costs, entry requirements and timings.</span></li>
        <li>${icon('check')}<span>Updates by email, phone or messaging, whichever you prefer.</span></li>
      </ul>
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
      <p>We are based in Ilford, east London, and work with students in the UK and around the world: school leavers, people returning to study, and graduates looking for a master’s. Every first consultation is free, and we will always tell you plainly whether a course, a university or a budget is realistic.</p>
    </div>
    <div class="reveal">${pic('advice-session', 'An adviser and a student talking through her plans at a desk', '(min-width: 64em) 36rem, 92vw')}</div>
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
${ctaBand()}` });

const legalPage = (file, title, description, lede, sections) => pages.push({ file, title, description, body: `${pageHero(title, 'Legal', title, lede)}
<section class="section">
  <div class="container prose" style="max-width:46rem">
    <p class="legal-updated">Last updated: 12 October 2026</p>
    ${sections.map(([h, html]) => `<h2>${h}</h2>${html}`).join('\n    ')}
  </div>
</section>` });
const addr = CONTACT.address.join(', ');
const mail = `<a href="mailto:${CONTACT.email}">${CONTACT.email}</a>`;
const tel = `<a href="tel:${CONTACT.landline.tel}">${CONTACT.landline.label}</a>`;
legalPage('privacy.html', 'Privacy policy', 'How Learn UK collects, uses and protects your personal data when you use our website, contact us or work with us.', 'How we collect, use and protect your personal data.', [
  ['Who we are', `<p>Learn UK is a UK-based educational consultancy. We help students from the UK and around the world choose a UK university course, apply, and prepare for their studies.</p><p>We are the controller of the personal data described in this policy, which means we decide how and why it is used. You can contact us about anything in this policy:</p><ul><li>by email: ${mail}</li><li>by phone: ${tel}</li><li>by post: Learn UK, ${esc(addr)}</li></ul>`],
  ['Information you give us', `<p>When you fill in a form on this website, email us, call us or message us, you may give us:</p><ul><li>your name, email address, and phone or WhatsApp number</li><li>the country you live in</li><li>the level and subject you want to study, the course or university you are interested in, and when you want to start</li><li>anything else you choose to tell us in your message or during a consultation</li></ul><p>If you decide to work with us, we will also need information to support your application, such as:</p><ul><li>your date of birth, nationality and passport details</li><li>your education history, qualifications, grades and transcripts</li><li>English language test results</li><li>your personal statement and references</li><li>for a student visa, details of how your studies will be funded, which may include financial documents</li><li>the details of a parent, guardian or sponsor, if they are supporting you</li></ul><p>We will only ask for these when we need them, and we will tell you why.</p>`],
  ['Information we get from others', `<p>When you ask us to help with an application, we may receive information about it from universities and UCAS, such as offers, conditions and decisions. If a parent, guardian or sponsor contacts us on your behalf, they may give us some of your details.</p>`],
  ['Information collected by the website', `<p>This website does not use cookies, analytics or advertising tools, and it does not track you. Our website host keeps short-term technical logs, such as IP addresses and the pages requested, to keep the site secure and working. See our <a href="cookies.html">cookie policy</a>.</p>`],
  ['How we use your information', `<p>We use your information to:</p><ul><li>reply to your enquiry and arrange your free consultation</li><li>recommend universities and courses that suit you</li><li>help you prepare and send applications, and follow them up</li><li>help you prepare for your student visa, accommodation and arrival, if you ask us to</li><li>keep a record of our conversations, so you do not have to repeat yourself</li><li>deal with any complaint, and meet our legal and accounting obligations</li></ul><p>We do not sell your personal data. We do not send you marketing unless you have asked us to, and you can ask us to stop at any time.</p>`],
  ['Our legal basis', `<p>UK data protection law (the UK GDPR and the Data Protection Act 2018) says we must have a legal basis for using your personal data. Ours are:</p><ul><li><strong>Taking steps at your request, and providing our service:</strong> when you ask us to contact you, give you advice or help with an application</li><li><strong>Legitimate interests:</strong> to reply to enquiries, keep records of our advice and improve our service, in ways you would reasonably expect</li><li><strong>Legal obligation:</strong> where the law requires us to keep or share information</li><li><strong>Consent:</strong> where we ask for it, for example before sending you news about scholarships or open days. You can withdraw consent at any time</li></ul>`],
  ['Health and other sensitive information', `<p>We do not ask for sensitive information through this website. If you choose to tell us about a disability or health condition, for example so a university can support you, we will only use it for that purpose and with your explicit consent.</p>`],
  ['Students under 18', `<p>Many students start planning before they are 18. If you are under 18, please talk to a parent or guardian before you send us your details. We may ask to involve them before we help with an application.</p>`],
  ['Who we share it with', `<p>We only share your information when we need to:</p><ul><li><strong>Universities and UCAS:</strong> when you ask us to help with an application, we share the details that application needs</li><li><strong>Service providers:</strong> companies that help us run our business, who may only use your data to provide their service to us. These include FormSubmit, which delivers the forms on this website to our email inbox, our email provider and our website host</li><li><strong>People you ask us to involve:</strong> such as a parent, guardian or sponsor</li><li><strong>Authorities:</strong> if the law requires us to</li></ul><p>We do not send your information to UK Visas and Immigration. You make your own visa application.</p>`],
  ['Sending data outside the UK', `<p>Some of our service providers store or process data outside the UK. When they do, we make sure your data is protected by safeguards that UK law recognises, such as an adequacy decision or the UK’s international data transfer agreement. If you live outside the UK, we will also send information to you in your country when we reply.</p>`],
  ['How long we keep it', `<ul><li>If you make an enquiry but do not go on to work with us, we keep your details for up to two years after we were last in touch, then delete them.</li><li>If you work with us, we keep your records for up to six years after our support ends, so we can answer questions and meet our legal and accounting obligations.</li></ul><p>We may keep information for longer if we need it to deal with a complaint or a legal claim.</p>`],
  ['Keeping your data safe', `<p>We protect your information with secure, password-protected systems and limit access to the people who need it. Our website uses an encrypted connection (HTTPS). Please do not send passport or financial documents through the website forms. An adviser will tell you how to send them securely.</p>`],
  ['Your rights', `<p>You have the right to:</p><ul><li>ask for a copy of the personal data we hold about you</li><li>ask us to correct it if it is wrong or incomplete</li><li>ask us to delete it</li><li>ask us to limit how we use it, or object to how we use it</li><li>ask us to send it to you or another organisation in a usable format</li><li>withdraw your consent at any time, where we rely on consent</li></ul><p>To use any of these rights, email ${mail}. We will not charge you, and we will reply within one month. We may need to check your identity first.</p>`],
  ['Making a complaint', `<p>If you are unhappy with how we have used your data, please contact us first so we can try to put it right. You also have the right to complain to the Information Commissioner’s Office (ICO), the UK’s data protection regulator, at <a href="https://ico.org.uk/make-a-complaint/">ico.org.uk</a> or on 0303 123 1113.</p>`],
  ['Changes to this policy', `<p>We may update this policy from time to time. The date at the top shows when it last changed. If we make an important change, we will tell people we are working with.</p>`],
]);
legalPage('terms.html', 'Terms of use', 'The terms that apply when you use the Learn UK website.', 'The terms that apply when you use this website.', [
  ['About these terms', `<p>These terms apply to your use of this website, which is run by Learn UK, ${esc(addr)}. By using the website you agree to them. Please read them, and our <a href="privacy.html">privacy policy</a>, before you use the site.</p><p>If you decide to work with us, we will agree the details of our support with you separately, and those terms will apply to our service.</p>`],
  ['Information on this website', `<p>We aim to keep the information on this website accurate and up to date, but it is general guidance, not personal advice. University and course details come from official sources, mainly Discover Uni, and are refreshed every week. Universities can change their courses, entry requirements, fees and start dates at any time, and UK visa rules change regularly.</p><p>Always check the details on the university’s own website and the latest visa rules on GOV.UK before you make a decision or apply. Our advisers can help you do this.</p>`],
  ['Photos on this website', `<p>Some photos on this website show typical student life and university settings. Unless a caption says otherwise, they are not photos of a particular university or of our students.</p>`],
  ['No guarantee of a place or a visa', `<p>Universities decide who they offer places and scholarships to, and UK Visas and Immigration decides visa applications. We give advice and help you prepare the strongest application you can, but we cannot guarantee an offer, a scholarship or a visa.</p>`],
  ['Using our forms', `<p>When you send us an enquiry, please give accurate details so we can help you. Do not use our forms to send anything unlawful, offensive or harmful, or to send passport or financial documents. We may ignore or delete messages that misuse our forms.</p>`],
  ['Acceptable use', `<p>You must not:</p><ul><li>use this website in a way that breaks the law or harms others</li><li>try to get unauthorised access to the website or the systems it runs on</li><li>introduce viruses or other harmful code</li><li>copy large amounts of data from the website by automated means, except as allowed by the licence on the data</li></ul>`],
  ['Our content', `<p>The text, design, logos and images on this website belong to Learn UK or are used with permission. You may view, download and print pages for your own personal use. Please do not copy, republish or sell our content without our written permission.</p><p>Course and university data from Discover Uni is used under the <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/">Open Government Licence v3.0</a>.</p>`],
  ['Links to other websites', `<p>This website links to other websites, such as universities, UCAS and GOV.UK. We are not responsible for their content, and a link does not mean we endorse them.</p>`],
  ['Availability', `<p>We try to keep the website available, but we do not guarantee that it will always be available or free from errors. We may change or remove parts of it at any time.</p>`],
  ['Our liability', `<p>We are not responsible for any loss caused by relying on information on this website without checking it with the university or the official source. We are not liable for any indirect loss, or for any loss to a business.</p><p>Nothing in these terms limits our liability for death or personal injury caused by our negligence, for fraud, or for anything else where it would be unlawful to do so.</p>`],
  ['Changes to these terms', `<p>We may update these terms from time to time. The date at the top shows when they last changed. The terms in force when you use the website apply.</p>`],
  ['Law', `<p>These terms are governed by the law of England and Wales. If you live elsewhere in the UK or abroad, you may also be protected by the laws of the place you live, and you may be able to bring a claim in your local courts.</p>`],
  ['Contact us', `<p>If you have a question about these terms, email ${mail} or call ${tel}.</p>`],
]);
legalPage('cookies.html', 'Cookie policy', 'Learn UK’s website does not use cookies, analytics or tracking. Find out what the site does store and send.', 'This website does not use cookies.', [
  ['Cookies on this website', `<p>Cookies are small files that websites save on your device. Many sites use them to remember you, measure visits or show you adverts.</p><p>This website does not set any cookies. We do not use analytics, advertising or social media tracking tools. That is why we do not show a cookie banner.</p>`],
  ['What the website does store', `<p>The website does not save anything about you on your device. When you choose a course and press Enquire, the course details travel to the enquiry form in the page address, so the form can show them. They are not saved.</p>`],
  ['When you send a form', `<p>When you send an enquiry or ask for a call back, your details go to FormSubmit, the service that delivers our website forms to our email inbox. Nothing is sent until you press the button. Our <a href="privacy.html">privacy policy</a> explains how we use what you send.</p>`],
  ['Our website host', `<p>Our website host keeps short-term technical logs, such as IP addresses and the pages requested, to keep the site secure and working. These are not used to track you.</p>`],
  ['Other websites', `<p>When you follow a link to another website, such as a university, UCAS or GOV.UK, that website may use its own cookies. Please check its cookie policy.</p>`],
  ['If this changes', `<p>If we ever add cookies or analytics, we will update this page and ask for your consent first where the law requires it.</p>`],
]);
legalPage('accessibility.html', 'Accessibility statement', 'How accessible the Learn UK website is, how we test it, and how to tell us about a problem.', 'We want everyone to be able to use this website.', [
  ['Our aim', `<p>We want as many people as possible to be able to use this website. We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA.</p><p>You should be able to:</p><ul><li>use the whole site with a keyboard, including the menus, filters and forms</li><li>use it with a screen reader</li><li>zoom in up to 400% without text spilling off the screen</li><li>turn off animation, by setting your device to reduce motion</li><li>use it on a phone, tablet or computer</li></ul>`],
  ['What we have done', `<ul><li>Text and buttons meet WCAG contrast levels</li><li>Every page has a skip link, clear headings and labelled landmarks</li><li>Form errors are listed at the top of the form, with links to each field</li><li>Images that carry meaning have text descriptions, and decorative images are hidden from screen readers</li><li>The 3D globe on the home page is decorative. If your device asks for reduced motion, or cannot run 3D, you see a still image instead</li></ul>`],
  ['How we test', `<p>Every time we change the website, we run automated accessibility checks (axe-core, against WCAG 2.2 AA) on every page, on desktop and mobile screen sizes, and test the enquiry form with a keyboard and on a touch screen.</p>`],
  ['Known limitations', `<p>So far our testing has used the Chromium browser engine (used by Chrome and Edge). We have not yet tested fully with Safari, Firefox or every screen reader. Automated checks cannot find every problem, so if something does not work for you, please tell us.</p>`],
  ['Tell us about a problem', `<p>If you find a problem, or need information from this website in another format, email ${mail} or call ${tel}. Tell us the page and what went wrong. We will reply within five working days.</p>`],
  ['About this statement', `<p>We prepared this statement on 12 October 2026, based on our own testing. We will review it when we make major changes to the website.</p>`],
]);
legalPage('complaints.html', 'Complaints', 'How to make a complaint to Learn UK and what happens next.', 'If something has gone wrong, we want to put it right.', [
  ['How to complain', `<p>If you are unhappy with our advice, our service or anything else, please tell us. Most problems can be sorted out quickly by talking to your adviser.</p><p>If that does not solve it, contact us:</p><ul><li>by email: ${mail}, with “Complaint” in the subject</li><li>by phone: ${tel}</li><li>by post: Learn UK, ${esc(addr)}</li></ul><p>Please tell us your name and how to contact you, what happened and when, and what you would like us to do.</p>`],
  ['What happens next', `<ol><li>We will confirm we have received your complaint within three working days.</li><li>Someone not involved in the issue will look into it. They may contact you to find out more.</li><li>We will send you a full written reply within 15 working days. If we need longer, we will tell you why and when to expect it.</li></ol>`],
  ['If you are still unhappy', `<p>If you are not satisfied with our reply, tell us and a senior member of our team will review the complaint and the decision. Their reply is our final response.</p><p>If your complaint is about how we used your personal data, you can also complain to the Information Commissioner’s Office (ICO) at <a href="https://ico.org.uk/make-a-complaint/">ico.org.uk</a>.</p>`],
  ['Complaints about a university', `<p>If your complaint is about a university’s decision or service, we can explain how to use that university’s own complaints procedure. Universities in England and Wales are also covered by the Office of the Independent Adjudicator for Higher Education (OIA) for complaints from their students.</p>`],
  ['We will treat you fairly', `<p>Making a complaint will not affect the support we give you. We keep complaints confidential and use them to improve our service.</p>`],
]);

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
        <section class="selected-course" data-selected-course aria-labelledby="sc-title" hidden>
          <p class="eyebrow" id="sc-title">The course you are asking about</p>
          <h2 class="selected-course-title" data-course-title></h2>
          <dl class="selected-course-meta"></dl>
          <p class="selected-course-actions"><a href="courses.html">Choose a different course</a><button type="button" class="link-btn" data-clear-course>Remove this course</button></p>
        </section>
        <h2 id="form-title" style="font-size:var(--step-2)">Your details</h2>
        <p style="color:var(--ink-soft)">All fields are required unless marked optional.</p>
        <div class="error-summary" data-error-summary tabindex="-1" role="alert" hidden><h2>There is a problem</h2><ul></ul></div>
        <div class="form-grid form-grid--2">
          ${field('name', 'Full name', `<input class="input" id="name" name="name" type="text" autocomplete="name" required data-validate ${desc('name')}>`)}
          ${field('email', 'Email address', `<input class="input" id="email" name="email" type="email" pattern="[^@\\s]+@[^@\\s]+\\.[^@\\s]+" autocomplete="email" inputmode="email" spellcheck="false" required data-validate ${desc('email')}>`)}
          ${field('phone', 'Phone or WhatsApp number (optional)', `<input class="input" id="phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" pattern="[+0-9 ()-]{7,20}" placeholder="+44 7700 900123" data-validate ${desc('phone', true)}>`, { hint: 'Include your country code, for example +44 7700 900123 or +880 1712 345678' })}
          ${field('country', 'Country you live in', `<select class="select" id="country" name="country" autocomplete="country-name" required data-validate ${desc('country')}><option value="">Select a country</option>${countries.map((c) => `<option>${c}</option>`).join('')}</select>`)}
          ${field('level', 'Level of study', `<select class="select" id="level" name="level" required data-validate ${desc('level')}><option value="">Select a level</option><option>Foundation</option><option>Undergraduate</option><option>Postgraduate</option><option>Not sure yet</option></select>`)}
          ${field('intake', 'Preferred start (optional)', `<select class="select" id="intake" name="intake"><option value="">Not sure yet</option><option>As soon as possible</option><option>Within 3 months</option><option>Within 6 months</option><option>Within a year</option><option>More than a year from now</option></select>`, { error: false })}
          <div class="span-2">${field('interest', 'Course or subject you are interested in (optional)', `<input class="input" id="interest" name="interest" type="text" autocomplete="off">`, { error: false })}</div>
          <div class="span-2">${field('message', 'Anything else we should know? (optional)', `<textarea class="textarea" id="message" name="message" rows="4"></textarea>`, { error: false })}</div>
          <div class="span-2 field">
            <div class="check"><input id="consent" name="consent" type="checkbox" required data-validate ${desc('consent')}><label for="consent" style="font-weight:400">I agree that Learn UK can contact me about my enquiry. Read our <a href="privacy.html">privacy policy</a>. <span class="visually-hidden">(required)</span></label></div>
            <p class="error" id="consent-error">${icon('info', 'style="width:1rem;height:1rem;flex:none"')}<span></span></p>
          </div>
        </div>
        <div style="margin-top:var(--space-4)"><button class="btn" type="submit"><span data-label>Send enquiry</span> ${icon('arrow')}</button></div>
      </form>
      <div class="success" data-success hidden>
        <div class="tick">${icon('check')}</div>
        <h2 tabindex="-1">Thank you, <span data-first-name></span></h2>
        <p>Your enquiry is ready. An adviser will be in touch to arrange your consultation.</p>
        <button class="btn btn--ghost" type="button" data-reset-enquiry>Send another enquiry</button>
      </div>
    </div>
    <aside class="panel" aria-labelledby="expect-title" style="background:var(--navy);color:var(--white);border-color:var(--navy)">
      ${pic('video-call', 'An adviser waving to a student on a video call', '(min-width: 64em) 26rem, 92vw', { cls: 'aside-photo' })}
      <div class="on-dark">
        <h2 id="expect-title" style="font-size:var(--step-2);color:var(--white)">What happens next</h2>
        <ul class="list-check" style="color:var(--on-dark-soft)">
          <li>${icon('check')}<span>An adviser reviews your enquiry and contacts you to arrange a time.</span></li>
          <li>${icon('check')}<span>Your consultation is free, online or by phone, with no obligation.</span></li>
          <li>${icon('check')}<span>You leave with a clear plan and a shortlist to explore.</span></li>
        </ul>
        <hr style="border:0;border-top:1px solid rgb(255 255 255 / .15);margin:var(--space-4) 0">
        <p style="margin:0 0 .5rem;color:var(--white);font-weight:600">Prefer to call or email?</p>
        <ul class="contact-list">
          <li>${icon('mail')}<span>Email <a href="mailto:${CONTACT.email}">${CONTACT.email}</a></span></li>
          <li>${icon('phone')}<span>Office <a href="tel:${CONTACT.landline.tel}">${CONTACT.landline.label}</a></span></li>
          <li>${icon('phone')}<span>Mobile <a href="tel:${CONTACT.mobile.tel}">${CONTACT.mobile.label}</a></span></li>
          <li>${icon('pin')}<address>${CONTACT.address.join(', ')}</address></li>
        </ul>
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
  if (existsSync(ROOT + 'static/img')) cpSync(ROOT + 'static/img', OUT + 'assets/img', { recursive: true });
  writeFileSync(OUT + 'data/universities.json', JSON.stringify({ meta: dataMeta, universities }));
  // The courses page loads one compact file: universities by index, subjects by index, then courses.
  // Default order: by subject of the course name, ignoring the award (BA, BSc (Hons) ...) and stray quote marks.
  const AWARD = /^(?:(?:BA|BSc|BEng|BMus|BEd|BN|BNurs|BMid|BDes|BFA|BTh|BSW|BAcc|BBA|BM|BArch|BDS|BVSc|BVetMed|BVMS|BMedSci|LLB|MA|MSc|MEng|MSci|MChem|MPhys|MMath|MPharm|MBiol|MComp|MArts|MDes|MArch|MNurs|MOst|MChiro|MGeol|MEnv|MPlan|MSW|MB|MBBS|MBChB|FdA|FdSc|FdEng|HND|HNC|DipHE|CertHE)\b\.?\s*(?:\([A-Za-z]{2,8}\))?\s*(?:[/&,]\s*)?)+/;
  // Clean up capitals in the source titles: "BA 3d Design And Craft" becomes "BA 3D Design and Craft".
  const SMALL = /(?<!^|: )\b(And|Of|In|With|For|The|To|On|At|From|Or)\b/g;
  const tidyTitle = (t) => {
    t = t.replace(/["“”]/g, '').replace(/\s+/g, ' ').trim().replace(/\b([23])d\b/g, '$1D');
    const award = (t.match(AWARD) || [''])[0];
    return award + t.slice(award.length).replace(SMALL, (w) => w.toLowerCase());
  };
  const sortKey = (t) => t.replace(AWARD, '').toLowerCase();
  const clientCourses = courseData.courses.map((c) => [tidyTitle(c[0]), ...c.slice(1)]).sort((a, b) => sortKey(a[0]).localeCompare(sortKey(b[0])) || a[0].localeCompare(b[0]));
  const client = { updated: dataMeta.updated, u: universities.map((u) => [u.slug, u.name, u.city || '', u.nation || '', u.ukprn]), s: subjects, c: clientCourses };
  writeFileSync(OUT + 'data/courses.json', JSON.stringify(client));

  for (const p of pages) writeFileSync(OUT + p.file, page(p));
  // A plain-text summary for AI assistants and search tools (llmstxt.org format).
  writeFileSync(OUT + 'llms.txt', `# Learn UK

> UK-based educational consultancy helping students from the UK and around the world study at UK universities. Free first consultation; help with choosing a course, UCAS and direct applications, English tests, scholarships, Student visa documents and arrival. Office: ${CONTACT.address.join(', ')}. Email ${CONTACT.email}, phone ${CONTACT.landline.label}.

## Pages

${pages.map((p) => `- [${p.title}](${p.file}): ${p.description}`).join('\n')}

## Frequently asked questions

${FAQS.flatMap((g) => g.items).map(([q, a]) => `- ${strip(q)} ${strip(a)}`).join('\n')}
`);
  console.log('Built', pages.length, 'pages to dist/');
}
main();
