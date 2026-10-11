// Fetches real UK university and course data and writes src/data/universities.json and src/data/courses.json.
//
// Sources
//   Courses and providers: Discover Uni (Office for Students, HESA and the UK funding bodies), via the public
//   search API that powers discoveruni.gov.uk. Contains public sector information licensed under the
//   Open Government Licence v3.0.
//   Website, city and university status: Wikidata (CC0), matched on UK Provider Reference Number (UKPRN).
//
// Run: node tools/fetch-data.mjs   (needs Node 18+ for global fetch; no dependencies)
// It refuses to write anything if the results look incomplete, so a failed run never empties the site.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.DATA_OUT || ROOT + '/src/data/';
const API = 'https://search-api-v2-prod-hxhpghhdg3dqdhft.uksouth-01.azurewebsites.net/api/v2';
const UA = 'LearnUK-data/1.0 (+https://github.com/fbnayem/learnUK)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function http(url, opts = {}, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { ...opts, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) throw e;
      await sleep(1000 * 2 ** i);
    }
  }
}
const post = (path, body) => http(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const BASE_QUERY = { query: '', selectedInstitutions: [], modeFullTime: false, modePartTime: false, locOnCampus: false, locDistanceLearning: false,
  regionScotland: false, regionWales: false, regionNorthernIreland: false, regionEngland: false, postcodeQuery: null, cityQuery: null };

// 1. Every undergraduate course on Discover Uni (id = UKPRN/KISCOURSEID/mode).
const all = await post('/search/', BASE_QUERY);
console.log(`Discover Uni: ${all.length} courses listed`);

// 2. Nation of each provider, from Discover Uni's own region filter.
const nationOf = new Map();
for (const [flag, nation] of [['regionEngland', 'England'], ['regionScotland', 'Scotland'], ['regionWales', 'Wales'], ['regionNorthernIreland', 'Northern Ireland']]) {
  const hits = await post('/search/', { ...BASE_QUERY, [flag]: true });
  for (const h of hits) nationOf.set(Number(h.courseId.split('/')[0]), nation);
  await sleep(300);
}

// 3. Details for full-time courses (international students on a Student visa study full-time).
const ftIds = all.map((c) => c.courseId).filter((id) => /\/Full-time$/i.test(id));
const details = [];
for (let i = 0; i < ftIds.length; i += 200) {
  details.push(...(await post('/search/courses/', { courseIds: ftIds.slice(i, i + 200) })));
  if (i % 4000 === 0) console.log(`  details ${Math.min(i + 200, ftIds.length)}/${ftIds.length}`);
  await sleep(250);
}
console.log(`Discover Uni: ${details.length} full-time course records`);

// 4. Wikidata facts for each provider, matched by UKPRN.
const ukprns = [...new Set(details.map((d) => String(d.institutionId)))];
const sparql = `SELECT ?ukprn ?item ?itemLabel ?website ?placeLabel ?hqLabel ?inLondon ?isUni ?founded WHERE {
  VALUES ?ukprn { ${ukprns.map((u) => `"${u}"`).join(' ')} }
  ?item wdt:P4971 ?ukprn .
  OPTIONAL { ?item wdt:P856 ?website . }
  OPTIONAL { ?item wdt:P131 ?place . ?place wdt:P31/wdt:P279* wd:Q486972 . }
  OPTIONAL { ?item wdt:P159 ?hq . }
  OPTIONAL { ?item wdt:P571 ?founded . }
  BIND(EXISTS { ?item wdt:P131* wd:Q84 } || EXISTS { ?item wdt:P131* wd:Q23306 } AS ?inLondon)
  BIND(EXISTS { ?item wdt:P31/wdt:P279* wd:Q3918 } AS ?isUni)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
const wd = await http('https://query.wikidata.org/sparql', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' }, body: 'query=' + encodeURIComponent(sparql) });
const facts = new Map();
for (const b of wd.results.bindings) {
  const k = Number(b.ukprn.value);
  const f = facts.get(k) || { websites: new Set(), places: new Set(), hqs: new Set(), founded: [] };
  if (b.itemLabel && !/^Q\d+$/.test(b.itemLabel.value)) f.label = b.itemLabel.value;
  if (b.hqLabel && !/^Q\d+$/.test(b.hqLabel.value)) f.hqs.add(b.hqLabel.value);
  if (b.website) f.websites.add(b.website.value);
  if (b.placeLabel && !/^Q\d+$/.test(b.placeLabel.value)) f.places.add(b.placeLabel.value);
  if (b.founded) f.founded.push(Number(b.founded.value.slice(0, 5).replace('+', '')));
  f.inLondon ||= b.inLondon?.value === 'true';
  f.isUni ||= b.isUni?.value === 'true';
  f.item = b.item.value.split('/').pop();
  facts.set(k, f);
}
console.log(`Wikidata: matched ${facts.size} of ${ukprns.length} providers`);

// Places Wikidata does not record (checked against each university's own contact page).
const CITY_OVERRIDES = { 'Arden University': 'Coventry', 'Hartpury University': 'Gloucester', 'Northeastern University London': 'London',
  'University College of Estate Management': 'Reading', 'University of London institute in Paris': 'Paris' };
// Discover Uni sometimes lists a legal name in capitals; prefer a readable form.
const tidyName = (name, f) => {
  if (name !== name.toUpperCase()) return name;
  if (f?.label) return f.label;
  return name.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Of|And|The|For|In|At)\b/g, (w) => w.toLowerCase()).replace(/^the /, 'The ');
};

// 5. Keep universities: Wikidata says it is a university, or "University" is in its name.
const byUni = new Map();
for (const d of details) {
  const k = d.institutionId;
  if (!byUni.has(k)) byUni.set(k, { ukprn: k, name: d.institution.trim(), courses: [] });
  byUni.get(k).courses.push(d);
}
const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pickSite = (set) => [...set].sort((a, b) => a.length - b.length)[0] || null;
const universities = [];
for (const u of byUni.values()) {
  const f = facts.get(u.ukprn);
  const looksLikeUni = /\buniversity\b/i.test(u.name) && !/^university cent(re|er)\b/i.test(u.name);
  if (!(f?.isUni || looksLikeUni)) continue;
  const name = tidyName(u.name, f);
  const city = f?.inLondon ? 'London' : CITY_OVERRIDES[name] || [...(f?.places || [])].sort()[0] || [...(f?.hqs || [])].sort()[0] || null;
  universities.push({
    slug: slugify(name.replace(/^the\s+/i, '')),
    name,
    ukprn: u.ukprn,
    city,
    nation: nationOf.get(u.ukprn) || null,
    website: f ? pickSite(f.websites) : null,
    founded: f?.founded.length ? Math.min(...f.founded) : null,
    wikidata: f?.item || null,
    courseCount: u.courses.length,
  });
}
universities.sort((a, b) => a.name.replace(/^(the )?university of /i, '').localeCompare(b.name.replace(/^(the )?university of /i, '')));
const slugs = new Set();
for (const u of universities) { while (slugs.has(u.slug)) u.slug += '-' + u.ukprn; slugs.add(u.slug); }
const uniIndex = new Map(universities.map((u, i) => [u.ukprn, i]));

// 6. Courses, stored compactly: the courses page loads this file on demand.
const subjects = [...new Set(details.flatMap((d) => (d.subjects || []).map((s) => s.en)))].filter(Boolean).sort();
const subjIndex = new Map(subjects.map((s, i) => [s, i]));
const avail = (v) => { const t = (v?.en || '').toLowerCase(); return t.startsWith('compulsory') ? 2 : t.startsWith('optional') ? 1 : 0; };
const courses = details
  .filter((d) => uniIndex.has(d.institutionId))
  .map((d) => {
    const [, kis, mode] = d.courseId.split('/');
    return [
      d.name.trim(),                                            // 0 title
      uniIndex.get(d.institutionId),                            // 1 university index
      (d.subjects || []).map((s) => subjIndex.get(s.en)).filter((x) => x !== undefined), // 2 subject indexes
      (d.length || '').replace(/-year course$/, ' years').replace(/^1 years$/, '1 year') || null, // 3 length
      avail(d.placementYear),                                   // 4 placement year: 0 none, 1 optional, 2 compulsory
      avail(d.abroad),                                          // 5 year abroad
      (d.location || []).join(', ') || null,                    // 6 campus
      `${kis}/${mode}`,                                         // 7 Discover Uni id (with the UKPRN gives the course page)
    ];
  })
  .sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1]);

// 7. Sanity checks before writing anything.
const problems = [];
if (universities.length < 100) problems.push(`only ${universities.length} universities`);
if (courses.length < 10000) problems.push(`only ${courses.length} courses`);
if (universities.filter((u) => u.nation).length < universities.length * 0.95) problems.push('nation missing for many universities');
if (problems.length) { console.error('Not writing data: ' + problems.join('; ')); process.exit(1); }

const updated = new Date().toISOString().slice(0, 10);
const source = {
  courses: 'Discover Uni (Office for Students, HESA and the UK higher education funding bodies), Open Government Licence v3.0',
  facts: 'Wikidata (CC0), matched by UK Provider Reference Number',
  scope: 'Full-time undergraduate courses listed on Discover Uni at UK universities',
};
mkdirSync(OUT, { recursive: true });
writeFileSync(OUT + 'universities.json', JSON.stringify({ meta: { updated, source }, universities }, null, 1) + '\n');
writeFileSync(OUT + 'courses.json', JSON.stringify({ meta: { updated, source, fields: ['title', 'university', 'subjects', 'length', 'placementYear', 'yearAbroad', 'campus', 'discoverUniId'] }, subjects, courses }) + '\n');
console.log(`Wrote ${universities.length} universities and ${courses.length} courses (${subjects.length} subjects).`);
const noCity = universities.filter((u) => !u.city).map((u) => u.name);
const noSite = universities.filter((u) => !u.website).map((u) => u.name);
console.log(`Missing city: ${noCity.length}${noCity.length ? ' — ' + noCity.slice(0, 15).join('; ') : ''}`);
console.log(`Missing website: ${noSite.length}${noSite.length ? ' — ' + noSite.slice(0, 15).join('; ') : ''}`);
