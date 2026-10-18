import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../tools/validate.mjs';

const ok = () => ({
  generated: '2026-10-18T00:00:00+03:00',
  semester: { start: '2026-10-25', end: '2027-01-29', breaks: [] },
  courses: [{ id: 'a', name: 'A', color: '#123456' }],
  schedule: [{ course: 'a', day: 1, start: '10:00', end: '12:00', type: 'lecture', source: 'portal' }],
  exams: [{ course: 'a', moed: 'A', date: '2027-02-01', source: 'portal' }],
  assignments: [{ course: 'a', title: 't', due: '2026-11-01', source: 'syllabus' }],
  weekly: [{ week: 1, course: 'a', topic: 'x', items: [{ text: 'r', tag: 'קריאה' }], source: 'syllabus' }]
});

test('valid data has no errors (optional fields may be missing)', () => {
  assert.deepEqual(validate(ok()), []);
});
test('unknown course id', () => {
  const d = ok(); d.exams[0].course = 'zzz';
  assert.match(validate(d).join('\n'), /exams\[0\].*course/);
});
test('bad date format', () => {
  const d = ok(); d.assignments[0].due = '1.11.2026';
  assert.match(validate(d).join('\n'), /assignments\[0\].*due/);
});
test('bad source', () => {
  const d = ok(); d.schedule[0].source = 'moodle';
  assert.match(validate(d).join('\n'), /schedule\[0\].*source/);
});
test('end before start in schedule', () => {
  const d = ok(); d.schedule[0].end = '09:00';
  assert.match(validate(d).join('\n'), /schedule\[0\].*end/);
});
test('bad tag', () => {
  const d = ok(); d.weekly[0].items[0].tag = 'xyz';
  assert.match(validate(d).join('\n'), /weekly\[0\].*tag/);
});
