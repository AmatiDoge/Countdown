import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, weekInfo, totalWeeks, todayClasses, nextClass, upcoming, daysUntil } from '../sem-a/lib.js';

const sem = {
  start: '2026-10-25', end: '2027-01-29',
  breaks: [{ from: '2026-11-08', to: '2026-11-12', label: 'חופשה לדוגמה' }]
};
const at = (d, hm = '12:00') => { const x = parseDate(d); const [h, m] = hm.split(':').map(Number); x.setHours(h, m); return x; };

test('before semester', () => {
  assert.deepEqual(weekInfo(at('2026-10-20'), sem), { status: 'before', daysUntil: 5 });
});
test('week 1 and 2', () => {
  assert.deepEqual(weekInfo(at('2026-10-25'), sem), { status: 'active', week: 1 });
  assert.deepEqual(weekInfo(at('2026-11-05'), sem), { status: 'active', week: 2 });
});
test('break week has label, next week continues numbering', () => {
  assert.deepEqual(weekInfo(at('2026-11-10'), sem), { status: 'break', label: 'חופשה לדוגמה' });
  assert.deepEqual(weekInfo(at('2026-11-15'), sem), { status: 'active', week: 3 });
});
test('after semester', () => {
  assert.deepEqual(weekInfo(at('2027-02-05'), sem), { status: 'after' });
});
test('totalWeeks skips break', () => {
  assert.equal(totalWeeks(sem), 13);
});

const schedule = [
  { course: 'a', day: 1, start: '10:00', end: '12:00' },
  { course: 'b', day: 1, start: '08:00', end: '09:30' },
  { course: 'c', day: 3, start: '14:00', end: '16:00' }
];
test('todayClasses: sorted, drops finished', () => {
  assert.deepEqual(todayClasses(at('2026-10-26', '07:00'), schedule).map(s => s.course), ['b', 'a']);
  assert.deepEqual(todayClasses(at('2026-10-26', '10:30'), schedule).map(s => s.course), ['a']);
  assert.deepEqual(todayClasses(at('2026-10-26', '18:00'), schedule), []);
});
test('nextClass rolls to a later day in the evening', () => {
  const n = nextClass(at('2026-10-26', '18:00'), schedule);
  assert.equal(n.item.course, 'c');
  assert.equal(n.date.getDay(), 3);
});
test('nextClass on empty schedule is null', () => {
  assert.equal(nextClass(at('2026-10-26'), []), null);
});
test('upcoming drops past and sorts', () => {
  const items = [{ t: 'x', due: '2026-11-01' }, { t: 'old', due: '2026-10-01' }, { t: 'y', due: '2026-10-28' }];
  assert.deepEqual(upcoming(at('2026-10-26'), items, 'due').map(i => i.t), ['y', 'x']);
});
test('item due today still counts as upcoming', () => {
  assert.equal(upcoming(at('2026-10-26', '23:00'), [{ due: '2026-10-26' }], 'due').length, 1);
});
test('daysUntil', () => {
  assert.equal(daysUntil(at('2026-10-26', '12:00'), parseDate('2026-10-28')), 2);
});

// --- single-day cancellations & course meetings ---
import { isNoClassDay, courseMeetings } from '../sem-a/lib.js';
const sem2 = { start: '2026-10-18', end: '2027-01-16',
  breaks: [{ from: '2026-10-27', to: '2026-10-27', label: 'בחירות' }] };
const sched2 = [{ course: 'e', day: 2, start: '11:30', end: '13:00', type: 'seminar' }];

test('isNoClassDay: single-day break', () => {
  assert.equal(isNoClassDay(parseDate('2026-10-27'), sem2)?.label, 'בחירות');
  assert.equal(isNoClassDay(parseDate('2026-10-28'), sem2), null);
});
test('single-day break does not consume a week number', () => {
  assert.deepEqual(weekInfo(at('2026-10-27'), sem2), { status: 'active', week: 2 });
});
test('todayClasses is empty on a cancelled day', () => {
  assert.deepEqual(todayClasses(at('2026-10-27', '08:00'), sched2, sem2), []);
});
test('nextClass skips a cancelled day', () => {
  const n = nextClass(at('2026-10-26', '20:00'), sched2, sem2);
  assert.equal(n.date.getDate(), 3); // 3.11, not 27.10
});
test('courseMeetings skips cancelled days', () => {
  const m = courseMeetings('e', sched2, sem2).map(d => `${d.getDate()}.${d.getMonth() + 1}`);
  assert.deepEqual(m.slice(0, 3), ['20.10', '3.11', '10.11']);
  assert.equal(m.length, 12);
});
