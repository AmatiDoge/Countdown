process.env.TZ = 'Asia/Jerusalem';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, daysUntil, todayClasses, nextClass } from '../sem-a/lib.js';

const at = (d, hm = '12:00') => { const x = parseDate(d); const [h, m] = hm.split(':').map(Number); x.setHours(h, m); return x; };
const sem = { start: '2026-10-18', end: '2027-01-16', breaks: [] };
const sched = [{ course: 'a', day: 0, start: '13:45', end: '15:15', type: 'lecture' }];

test('daysUntil across autumn DST change is exact', () => {
  assert.equal(daysUntil(at('2026-10-24'), parseDate('2026-10-26')), 2);
  assert.equal(daysUntil(at('2026-10-18'), parseDate('2027-01-25')), 99);
});
test('no classes after semester end', () => {
  assert.deepEqual(todayClasses(at('2027-01-24', '08:00'), sched, sem), []);
  assert.equal(nextClass(at('2027-01-20', '08:00'), sched, sem), null);
});
test('no classes before semester start; next class is the first real one', () => {
  assert.deepEqual(todayClasses(at('2026-10-11', '08:00'), sched, sem), []);
  assert.equal(nextClass(at('2026-10-11', '20:00'), sched, sem).date.getDate(), 18);
});
