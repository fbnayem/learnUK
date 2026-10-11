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

const photo = (brief, ar = '4 / 3', extra = '') => `<div class="photo-slot" style="--ar:${ar}" role="img" aria-label="Photo placeholder: ${esc(brief)}" ${extra}><span>${icon('camera')}<b>Photo slot</b>${esc(brief)}</span></div>`;

// Responsive photo from static/img/photos (made by tools/gen-photos.mjs).
const PHOTO_W = { 'study-documents': [480, 800, 1200], default: [480, 800, 1200, 1536] };
const pic = (name, alt, sizes, { w = 1536, h = 1024, cls = '', eager = false } = {}) => {
  const ws = PHOTO_W[name] || PHOTO_W.default;
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
        <p>Guidance for international students, from first question to first day at a UK university.</p>
      </div>
      <div><h2>Study</h2><ul><li><a href="universities.html">Universities</a></li><li><a href="courses.html">Courses</a></li><li><a href="application-journey.html">Application journey</a></li></ul></div>
      <div><h2>Learn UK</h2><ul><li><a href="services.html">Services</a></li><li><a href="about.html">About us</a></li><li><a href="faqs.html">FAQs</a></li><li><a href="contact.html">Contact</a></li></ul></div>
      <div><h2>Talk to us</h2><ul><li><a href="contact.html">Book a free consultation</a></li><li><a href="mailto:${CONTACT.email}">${CONTACT.email}</a></li><li><a href="tel:${CONTACT.landline.tel}">Office: ${CONTACT.landline.label}</a></li><li><a href="tel:${CONTACT.mobile.tel}">Mobile: ${CONTACT.mobile.label}</a></li></ul><address class="footer-address">${CONTACT.address.join('<br>')}</address></div>
    </div>
    <div class="footer-base"><span>© 2026 Learn UK. All rights reserved.</span><span>Privacy policy and terms: to be added before launch.</span></div>
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
  ['doc', 'Application support', 'Help with UCAS and direct applications, personal statements, references and the documents universities ask for.'],
  ['chat', 'English language guidance', 'Which English tests your chosen universities accept, the scores they ask for, and how to prepare.'],
  ['pound', 'Scholarships and budgeting', 'Find scholarships you can apply for and plan a realistic budget for fees and living costs.'],
  ['passport', 'Student visa guidance', 'A clear checklist for your CAS, financial evidence and visa documents, so nothing holds up your application.'],
  ['plane', 'Pre-departure and arrival', 'Accommodation options, what to pack, and what to do in your first week in the UK.'],
];

const WHY_US = [
  ['heart', 'Free first consultation', 'Talk through your options with an adviser at no cost, and get honest advice before you commit to anything.'],
  ['chat', 'Your own adviser, start to finish', 'One adviser gets to know your plans and stays with you from your shortlist to your first week, so you never have to explain things twice.'],
  ['shield', 'Honest, student-first advice', 'We recommend courses that suit your grades, goals and budget, and we tell you plainly when something is not the right fit.'],
  ['compass', 'Advice based on official data', `Our course search covers ${n(universities.length)} UK universities and ${n(courseTotal)} courses from official Discover Uni data, refreshed every week.`],
  ['pound', 'Help with funding', 'We help you find scholarships, plan a realistic budget and, for home students, apply for UK student finance.'],
  ['pin', 'A London office you can visit', 'Our team is based in Ilford, so your advice comes from people who know UK universities and student life first hand.'],
]

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
    ['Can you apply for my visa for me?', 'You make your own Student visa application. We give you a clear checklist and help you understand what each document is for. Always check the latest rules on GOV.UK.'],
    ['What is a CAS?', 'A Confirmation of Acceptance for Studies (CAS) is a reference number your university gives you once you have accepted an unconditional offer. You need it to apply for your Student visa.'],
    ['Will you help me find accommodation?', 'Yes. We explain the options, from university halls to private housing, and help you apply before you travel.'],
    ['How much money do I need to show for my visa?', 'You need to show you can pay your course fees and a set amount for living costs for up to nine months. The monthly amount is higher if you study in London. Check the current figures on GOV.UK.'],
    ['Do I need to pay for healthcare?', 'Most students pay the Immigration Health Surcharge as part of their visa application. It gives you access to the NHS while you study.'],
  ] },
  { group: 'Studying and living in the UK', items: [
    ['How long does a UK degree take?', 'Most undergraduate degrees take three years in England, Wales and Northern Ireland, and four years in Scotland. Most taught master’s degrees take one year.'],
    ['When do UK courses start?', 'Most courses start in September. Many universities also offer a January start on some courses.'],
    ['Can I work while I study?', 'Most students on a Student visa studying at degree level can work up to 20 hours a week during term time and full time in the holidays. Your visa sets your exact limit, so check it before you take a job.'],
    ['Can I stay in the UK after I graduate?', 'The Graduate route lets eligible students stay and work in the UK for a period after finishing their degree. The rules and length can change, so check GOV.UK for the current terms.'],
    ['Can I bring my family?', 'Most students on taught courses, including most master’s courses, cannot bring family members as dependants. Some research postgraduate students can. Check the latest rules on GOV.UK.'],
    ['Is the UK safe for international students?', 'UK university cities are generally welcoming to international students, and universities offer support services, from welcome weeks to student advice teams. We help you get to know your city before you arrive.'],
  ] },
];

// FAQs shown near the foot of each page, also published as FAQPage structured data.
const PAGE_FAQS = {
  'index.html': { title: 'Questions students often ask', items: [
    ['What does Learn UK do?', 'Learn UK is a UK university admissions service for international students. We help you choose a course and university, apply, prepare your Student visa documents and get ready to arrive.'],
    FAQS[0].items[0], FAQS[0].items[1], FAQS[1].items[0],
    ['Where is Learn UK based?', `Our office is at ${CONTACT.address.join(', ')}. We advise students in the UK and around the world by phone, video call and email.`],
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
    ['Do you help with personal statements?', 'Yes. We help you plan your personal statement, give feedback on your drafts and check your application before you submit it. The words must be your own.'],
    ['Do you help with Student visa applications?', 'We give you a clear checklist, explain each document and check you have everything before you apply. You submit the application yourself.'],
    ['Can you help me find scholarships?', 'Yes. We look for scholarships and fee discounts you are eligible for at the universities on your shortlist, and help you meet their deadlines.'],
    ['Do you help students outside the UK?', 'Yes. Most of our consultations happen by phone or video call, so you can work with us wherever you live.'],
  ] },
  'about.html': { title: 'Questions about Learn UK', items: [
    ['Who is Learn UK?', 'Learn UK is a UK-based admissions service that helps international students choose, apply for and start the right course at a UK university.'],
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
const ORG_LD = { '@context': 'https://schema.org', '@type': 'EducationalOrganization', name: 'Learn UK', description: 'UK university admissions support for international students: course matching, applications, Student visa guidance and arrival support.', email: CONTACT.email, telephone: CONTACT.landline.tel, address: { '@type': 'PostalAddress', streetAddress: '210 Olympic House, 28-42 Clements Road', addressLocality: 'Ilford', addressRegion: 'Essex', postalCode: 'IG1 1BA', addressCountry: 'GB' } };

const faqList = (items, open = false) => `<div class="faq">${items.map(([q, a], i) => `<details${open && i === 0 ? ' open' : ''}><summary><span class="q">${q}</span><span class="chev">${icon('chevron')}</span></summary><div class="answer"><p>${a}</p></div></details>`).join('')}</div>`;

const initials = (name) => name.replace(/^the\s+/i, '').replace(/\b(of|and|the|for|in|at|&)\b/gi, ' ').split(/[\s,'’-]+/).filter(Boolean).slice(0, 3).map((w) => w[0].toUpperCase()).join('');
const uniCard = (u, i = 0) => `<article class="card uni-card reveal" style="--i:${i % 3}" data-tilt data-item data-nation="${esc(u.nation || '')}" data-search="${esc([u.name, u.city, u.nation].filter(Boolean).join(' '))}">
  <div class="card-body">
    <div class="uni-head"><span class="monogram" aria-hidden="true">${esc(initials(u.name))}</span><div><h3><a class="card-link" href="courses.html?university=${u.slug}">${esc(u.name)}</a></h3>
    <p>${icon('pin', 'style="width:1em;height:1em;display:inline;vertical-align:-.125em;margin-right:.25rem"')}${esc([u.city, u.nation].filter(Boolean).join(', '))}</p></div></div>
    <ul class="meta">${u.nation ? `<li class="tag tag--royal">${esc(u.nation)}</li>` : ''}${u.founded && u.founded > 1000 ? `<li class="tag">Founded ${u.founded}</li>` : ''}</ul>
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
          <p class="lead-hint" id="lead-hint">Leave your details and an adviser will contact you.</p>
          <div class="search-grid">
            <div class="field">
              <label for="lead-phone">Phone or WhatsApp</label>
              <input class="input" id="lead-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" pattern="[+0-9 ()-]{7,20}" placeholder="07700 900123" required aria-describedby="lead-hint lead-phone-error">
              <p class="error" id="lead-phone-error">${icon('info', 'style="width:1rem;height:1rem;flex:none"')}<span>Enter a UK phone number, like 07700 900123</span></p>
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
      <div class="stat reveal" style="--i:2"><dt>main intakes: September, with January on many courses</dt><dd>2 intakes</dd></div>
    </dl>
    <div class="why-us">
      <div class="why-us-head reveal"><h3 id="why-us-title">Why students choose Learn UK</h3><p>Studying abroad is a big decision. Here is what you get when you work with us.</p></div>
      <div class="grid grid--3" role="list" aria-labelledby="why-us-title">${WHY_US.map(([ic, h, p], i) => `<div class="feature reveal" role="listitem" style="--i:${i % 3}"><div class="icon-tile">${icon(ic)}</div><h4>${h}</h4><p>${p}</p></div>`).join('')}</div>
      <div class="why-us-cta reveal"><a class="btn" href="contact.html">Book a free consultation ${icon('arrow')}</a></div>
    </div>
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

<section class="section section--mist" aria-labelledby="stories-title">
  <div class="container">
    <div class="section-head reveal"><div><p class="eyebrow">Student stories</p><h2 id="stories-title">Students who made the journey</h2><p>Real stories from Learn UK students will appear here once they have given permission.</p></div></div>
    <div class="grid grid--3">${[1, 2, 3].map((n, i) => `<figure class="quote reveal" style="--i:${i}">${photo('Student portrait', '1')}<div><blockquote><p>Placeholder for a real student testimonial, quoted in their own words with their permission.</p></blockquote><figcaption>Student name, course and university</figcaption></div></figure>`).join('')}</div>
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
      <div class="empty-state" data-empty hidden><p><strong>No universities match those filters.</strong></p><p>Try a different city or clear a filter. Or <a href="contact.html">ask an adviser</a> to suggest options.</p></div>
    </div>
  </div>
</section>
${ctaBand('Want help choosing?', 'An adviser can shortlist universities for your subject, grades and budget.')}` });

pages.push({ file: 'courses.html', title: 'Courses', description: `Search ${n(courseTotal)} full-time undergraduate courses at UK universities, from official Discover Uni data.`,
  body: `${pageHero('Courses', 'Study', 'Search UK courses', `Every full-time undergraduate course at UK universities listed on Discover Uni: ${n(courseTotal)} courses. Filter by subject, university and nation.`, '', ['library'])}
<section class="section section--mist">
  <div class="container">
    ${sourceNote('Full-time undergraduate courses only. Postgraduate courses are not in this official dataset; ask an adviser and we will search them with you.')}
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
    <div class="grid grid--3">${SERVICES.map(([ic, h, p], i) => `<div class="feature reveal" style="--i:${i % 3}"><div class="icon-tile">${icon(ic)}</div><h2 style="font-size:var(--step-1)">${h}</h2><p>${p}</p></div>`).join('')}</div>
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
          ${field('phone', 'Phone or WhatsApp number (optional)', `<input class="input" id="phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" pattern="[+0-9 ()-]{7,20}" placeholder="07700 900123" data-validate ${desc('phone', true)}>`, { hint: 'A UK number, for example 07700 900123' })}
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
  copyFileSync(SRC + 'data/universities.json', OUT + 'data/universities.json');
  // The courses page loads one compact file: universities by index, subjects by index, then courses.
  // Default order: by subject of the course name, ignoring the award (BA, BSc (Hons) ...) and stray quote marks.
  const AWARD = /^(?:(?:BA|BSc|BEng|BMus|BEd|BN|BNurs|BMid|BDes|BFA|BTh|BSW|BAcc|BBA|BM|BArch|BDS|BVSc|BVetMed|BVMS|BMedSci|LLB|MA|MSc|MEng|MSci|MChem|MPhys|MMath|MPharm|MBiol|MComp|MArts|MDes|MArch|MNurs|MOst|MChiro|MGeol|MEnv|MPlan|MSW|MB|MBBS|MBChB|FdA|FdSc|FdEng|HND|HNC|DipHE|CertHE)\b\.?\s*(?:\([A-Za-z]{2,8}\))?\s*(?:[/&,]\s*)?)+/;
  const tidyTitle = (t) => t.replace(/["“”]/g, '').replace(/\s+/g, ' ').trim();
  const sortKey = (t) => t.replace(AWARD, '').toLowerCase();
  const clientCourses = courseData.courses.map((c) => [tidyTitle(c[0]), ...c.slice(1)]).sort((a, b) => sortKey(a[0]).localeCompare(sortKey(b[0])) || a[0].localeCompare(b[0]));
  const client = { updated: dataMeta.updated, u: universities.map((u) => [u.slug, u.name, u.city || '', u.nation || '', u.ukprn]), s: subjects, c: clientCourses };
  writeFileSync(OUT + 'data/courses.json', JSON.stringify(client));

  for (const p of pages) writeFileSync(OUT + p.file, page(p));
  // A plain-text summary for AI assistants and search tools (llmstxt.org format).
  writeFileSync(OUT + 'llms.txt', `# Learn UK

> UK university admissions support for international students. Free first consultation; help with choosing a course, UCAS and direct applications, English tests, scholarships, Student visa documents and arrival. Office: ${CONTACT.address.join(', ')}. Email ${CONTACT.email}, phone ${CONTACT.landline.label}.

## Pages

${pages.map((p) => `- [${p.title}](${p.file}): ${p.description}`).join('\n')}

## Frequently asked questions

${FAQS.flatMap((g) => g.items).map(([q, a]) => `- ${strip(q)} ${strip(a)}`).join('\n')}
`);
  console.log('Built', pages.length, 'pages to dist/');
}
main();
