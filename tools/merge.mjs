// Merge sem-a/raw/{portal,calendar,syllabus}.json → sem-a/data.json
// Priority: portal > calendar > syllabus. Differences are printed for conflicts.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { weekInfo, courseMeetings } from '../sem-a/lib.js';
import { validate } from './validate.mjs';

const read = f => JSON.parse(readFileSync(`sem-a/raw/${f}.json`, 'utf8'));
const portal = read('portal'), calendar = read('calendar'), syllabus = read('syllabus');
const notes = [];

const exams = [...portal.exams];
for (const e of calendar.exams) {
  const p = exams.find(x => x.course === e.course && x.moed === e.moed);
  if (!p) exams.push(e);
  else if (p.date !== e.date || p.time !== e.time)
    notes.push(`exam ${e.course} ${e.moed}: portal ${p.date} ${p.time} vs calendar ${e.date} ${e.time}`);
}
for (const s of calendar.schedule) {
  if (!portal.schedule.some(p => p.course === s.course && p.day === s.day && p.start === s.start && p.end === s.end))
    notes.push(`schedule only in calendar: ${JSON.stringify(s)}`);
}

const weekly = [];
for (const s of syllabus.sessions) {
  const meetings = courseMeetings(s.course, portal.schedule, portal.semester);
  for (let k = s.from; k <= s.to; k++) {
    const d = meetings[k - 1];
    if (!d) { notes.push(`${s.course} session ${k} has no meeting date`); continue; }
    const w = weekInfo(d, portal.semester);
    weekly.push({ week: w.week, course: s.course, topic: s.topic,
      items: k === s.from ? s.items : [], source: 'syllabus' });
  }
}

const data = { generated: new Date().toISOString(), semester: portal.semester, courses: portal.courses,
  schedule: portal.schedule, exams: exams.sort((a, b) => a.date.localeCompare(b.date)),
  assignments: [...portal.assignments, ...syllabus.assignments], weekly };
const errs = validate(data);
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
writeFileSync('sem-a/data.json', JSON.stringify(data, null, 1) + '\n');
console.log(`data.json: ${data.exams.length} exams, ${data.schedule.length} slots, ${weekly.length} weekly`);
console.log(notes.length ? notes.join('\n') : 'no source differences');
