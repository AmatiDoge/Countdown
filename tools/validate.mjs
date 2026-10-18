import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;
const SOURCES = ['portal', 'calendar', 'syllabus'];
const TYPES = ['lecture', 'practice', 'workshop', 'seminar'];
const TAGS = ['קריאה', 'סרטון', 'מטלה', 'בוחן', 'שיעור', 'תרגול', 'פרזנטציה', 'צפייה'];

export function validate(d) {
  const e = [];
  const req = (cond, msg) => { if (!cond) e.push(msg); };
  req(DATE.test(d.semester?.start ?? ''), 'semester.start');
  req(DATE.test(d.semester?.end ?? ''), 'semester.end');
  (d.semester?.breaks || []).forEach((b, i) =>
    req(DATE.test(b.from) && DATE.test(b.to) && b.label, `semester.breaks[${i}]`));
  const ids = new Set((d.courses || []).map(c => c.id));
  (d.courses || []).forEach((c, i) => req(c.id && c.name && /^#[0-9a-f]{6}$/i.test(c.color), `courses[${i}]`));
  const each = (name, extra) => (d[name] || []).forEach((x, i) => {
    const p = `${name}[${i}]`;
    req(ids.has(x.course), `${p}.course unknown: ${x.course}`);
    req(SOURCES.includes(x.source), `${p}.source: ${x.source}`);
    extra(x, p);
  });
  each('schedule', (x, p) => {
    req(Number.isInteger(x.day) && x.day >= 0 && x.day <= 6, `${p}.day`);
    req(TIME.test(x.start), `${p}.start`);
    req(TIME.test(x.end) && x.end > x.start, `${p}.end`);
    req(TYPES.includes(x.type), `${p}.type`);
  });
  each('exams', (x, p) => {
    req(['A', 'B'].includes(x.moed), `${p}.moed`);
    req(DATE.test(x.date), `${p}.date`);
    req(x.time === undefined || TIME.test(x.time), `${p}.time`);
  });
  each('assignments', (x, p) => {
    req(x.title, `${p}.title`);
    req(DATE.test(x.due), `${p}.due`);
  });
  each('weekly', (x, p) => {
    req(Number.isInteger(x.week) && x.week >= 1, `${p}.week`);
    (x.items || []).forEach((it, j) => req(it.text && TAGS.includes(it.tag), `${p}.items[${j}].tag/text`));
  });
  return e;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errs = validate(JSON.parse(readFileSync(process.argv[2], 'utf8')));
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  console.log('data.json OK');
}
