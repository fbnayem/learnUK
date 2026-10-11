// Writes the sample university and course data. Fees, intakes and course lists
// are ILLUSTRATIVE placeholders for layout and filtering, not verified facts.
import { writeFileSync } from 'node:fs';
const unis = [
  ['manchester', 'The University of Manchester', 'Manchester', 'North West England', 'England', 'City'],
  ['birmingham', 'University of Birmingham', 'Birmingham', 'West Midlands', 'England', 'Campus'],
  ['leeds', 'University of Leeds', 'Leeds', 'Yorkshire', 'England', 'City'],
  ['nottingham', 'University of Nottingham', 'Nottingham', 'East Midlands', 'England', 'Campus'],
  ['sheffield', 'The University of Sheffield', 'Sheffield', 'Yorkshire', 'England', 'City'],
  ['newcastle', 'Newcastle University', 'Newcastle upon Tyne', 'North East England', 'England', 'City'],
  ['bristol', 'University of Bristol', 'Bristol', 'South West England', 'England', 'City'],
  ['coventry', 'Coventry University', 'Coventry', 'West Midlands', 'England', 'City'],
  ['hertfordshire', 'University of Hertfordshire', 'Hatfield', 'East of England', 'England', 'Campus'],
  ['glasgow', 'University of Glasgow', 'Glasgow', 'Scotland', 'Scotland', 'City'],
  ['cardiff', 'Cardiff University', 'Cardiff', 'Wales', 'Wales', 'City'],
  ['queens-belfast', "Queen's University Belfast", 'Belfast', 'Northern Ireland', 'Northern Ireland', 'City'],
];
const subjects = {
  Business: ['BSc Business Management', 'MSc International Business', 'MBA'],
  Computing: ['BSc Computer Science', 'MSc Data Science', 'MSc Artificial Intelligence'],
  Engineering: ['MEng Mechanical Engineering', 'BEng Civil Engineering', 'MSc Renewable Energy Engineering'],
  Health: ['BSc Nursing (Adult)', 'MSc Public Health', 'BSc Biomedical Science'],
  Law: ['LLB Law', 'LLM International Commercial Law'],
  'Arts & Design': ['BA Graphic Design', 'MA Media and Communication'],
  Finance: ['BSc Accounting and Finance', 'MSc Finance and Investment'],
};
const levelOf = (t) => t.startsWith('MSc') || t.startsWith('MA ') || t.startsWith('LLM') || t === 'MBA' ? 'Postgraduate' : 'Undergraduate';
const courses = [];
let k = 0;
for (const [subject, titles] of Object.entries(subjects)) {
  for (const title of titles) {
    for (let j = 0; j < 2; j++) {
      const u = unis[(k * 5 + j * 7) % unis.length];
      const level = levelOf(title);
      const pg = level === 'Postgraduate';
      courses.push({
        id: `${u[0]}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}`,
        title, university: u[0], subject, level,
        duration: pg ? (title === 'MBA' ? '12–15 months' : '1 year') : title.startsWith('MEng') ? '4 years' : '3 years',
        intakes: pg && (k + j) % 2 === 0 ? ['January', 'September'] : ['September'],
        feeFromGBP: (pg ? 21000 : 19500) + ((k * 3 + j * 5) % 9) * 750,
        foundationAvailable: !pg && (k + j) % 3 === 0,
      });
    }
    k++;
  }
}
const meta = { note: 'Sample data for design and development only. Fees, intakes and course availability are illustrative and must be replaced with verified university information before launch.', updated: '2026-10-10' };
writeFileSync('src/data/universities.json', JSON.stringify({ meta, universities: unis.map(([slug, name, city, area, nation, setting]) => ({
  slug, name, city, area, nation, setting,
  intakes: slug === 'glasgow' || slug === 'queens-belfast' ? ['September'] : ['January', 'September'],
  courseCount: courses.filter((c) => c.university === slug).length,
  photo: { status: 'placeholder', brief: `Authentic photo of students on campus at ${name}` },
})) }, null, 2));
writeFileSync('src/data/courses.json', JSON.stringify({ meta, courses }, null, 2));
console.log(unis.length, 'universities', courses.length, 'courses');
