# לו״ז שנה ג׳ סמסטר א׳ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** דף `sem-a/` ב-Countdown שמציג לו״ז סמסטר א׳ (שיעורי היום, מטלות, מבחנים, תוכן שבועי) מתוך `data.json` שנבנה מסילבוסים, המרכז האישי ו-Apple Calendar, ומוצג ב-Plash.

**Architecture:** שלוש שכבות נפרדות: (1) `sem-a/lib.js` — פונקציות טהורות (חישוב שבוע, שיעורי היום, הפריט הבא) כ-ES module שרץ גם בדפדפן וגם ב-node לבדיקות; (2) `sem-a/data.json` — הנתונים, נבנים ידנית ע"י הסוכן מהמקורות ומאומתים ע"י `tools/validate.mjs`; (3) `sem-a/index.html` — תצוגה בלבד, טוענת את שניהם.

**Tech Stack:** HTML/CSS/vanilla JS (ES modules), node 25 (`node --test`) לבדיקות בלבד, GitHub Pages, Plash. ללא build step וללא תלויות npm.

**Spec:** `docs/superpowers/specs/2026-10-18-sem-a-schedule-design.md`

## Global Constraints

- `index.html` בשורש (סמסטר ב׳) לא משתנה.
- URL יעד: `https://amatidoge.github.io/Countdown/sem-a/`.
- localStorage: prefix `sem_a_` בלבד; אסור לגעת במפתחות `academic_hub_*_v158`.
- `source` ∈ `portal | calendar | syllabus`; עדיפות בסתירה: portal ← calendar ← syllabus; כל סתירה נרשמת ב-`sem-a/conflicts.md`.
- `day`: 0=ראשון … 6=שבת. תאריכים `YYYY-MM-DD`, שעות `HH:MM`.
- מספרי שבוע מחושבים מ-`semester.start` + `breaks`, לא מוקלדים.
- RTL, עברית, שפה עיצובית של ה-Countdown הקיים (`:root` vars, `.box`, `.header`, `.item-row`, `.timer`, `.bg-red/.bg-green/.bg-passed`).
- מרכז אישי: קריאה בלבד דרך Chrome של המשתמש; אם נדרשת התחברות — עוצרים והמשתמש מתחבר בעצמו.
- Apple Calendar: קריאה בלבד.
- קורסים: 6 קורסי התיקייה + סמינר מחקרי הונרס שנה ג׳; רב-משתנית לפי סילבוס בירנבוים.

## Review Focus

1. **תאריך בתוך חופשה / לפני תחילת סמסטר / אחרי סופו** — הדף צריך להציג "חופשה: <שם>" / "הסמסטר מתחיל בעוד N ימים" / שבוע אחרון, לא שבוע 0 או NaN. נבדק ב-Task 1.
2. **מבחן או מטלה שהתאריך שלהם עבר** — לא נבחרים כ"הבא בתור"; מוצגים אפורים. נבדק ב-Task 1.
3. **פריט בלי שעה / בלי חדר / בלי מרצה** — מוצג בלי השדה, לא `undefined`. נבדק ב-Task 2 (validator מתיר) וב-Task 5 (render).
4. **`data.json` לא נטען (offline ב-Plash, 404)** — הודעה ברורה, לא מסך לבן. Task 5.
5. **ערב: אין יותר שיעורים היום** — רצועת "היום" אומרת "אין עוד שיעורים היום" ומציגה את השיעור הבא (מחר). נבדק ב-Task 1.

---

### Task 1: לוגיקת זמן — `sem-a/lib.js`

**Files:**
- Create: `sem-a/lib.js`
- Test: `tests/lib.test.mjs`

**Interfaces:**
- Produces:
  - `parseDate(s: "YYYY-MM-DD") → Date` (חצות מקומית)
  - `weekInfo(date: Date, semester) → {status:"before", daysUntil:number} | {status:"break", label:string} | {status:"active", week:number} | {status:"after"}`
  - `totalWeeks(semester) → number`
  - `todayClasses(date: Date, schedule) → Array<scheduleItem>` ממוין לפי `start`, רק כאלה ש-`end` > עכשיו
  - `nextClass(date: Date, schedule) → {item, date: Date} | null` (השיעור הבא אחרי עכשיו, כולל ימים הבאים)
  - `upcoming(date: Date, items, field="due"|"date") → Array` (עתידיים בלבד, ממוינים)
  - `daysUntil(date: Date, target: Date) → number` (ימים שלמים, ceil)

שבוע = בלוק של 7 ימים החל מ-`semester.start`. בלוק הוא "חופשה" אם כל ימי א׳–ה׳ שלו נופלים בתוך break כלשהו. מספר השבוע = 1 + מספר הבלוקים שאינם חופשה לפניו.

- [ ] **Step 1: Write the failing test**

```js
// tests/lib.test.mjs
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
  assert.equal(totalWeeks(sem), 13); // 14 blocks to 2027-01-29, minus 1 break
});

const schedule = [
  { course: 'a', day: 1, start: '10:00', end: '12:00' },
  { course: 'b', day: 1, start: '08:00', end: '09:30' },
  { course: 'c', day: 3, start: '14:00', end: '16:00' }
];
test('todayClasses: sorted, drops finished', () => {
  // 2026-10-26 is Monday (day 1)
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/`
Expected: FAIL — `Cannot find module .../sem-a/lib.js`

- [ ] **Step 3: Write minimal implementation**

```js
// sem-a/lib.js
const DAY = 86400000;

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function blockIndex(date, start) {
  return Math.floor(Math.round((startOfDay(date) - start) / DAY) / 7);
}

function breakForBlock(k, semester) {
  const start = parseDate(semester.start);
  for (const b of semester.breaks || []) {
    const from = parseDate(b.from), to = parseDate(b.to);
    let all = true;
    for (let i = 0; i < 5; i++) { // Sun..Thu
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + k * 7 + i);
      if (d < from || d > to) { all = false; break; }
    }
    if (all) return b;
  }
  return null;
}

export function weekInfo(date, semester) {
  const start = parseDate(semester.start), end = parseDate(semester.end);
  const day = startOfDay(date);
  if (day < start) return { status: 'before', daysUntil: Math.round((start - day) / DAY) };
  if (day > end) return { status: 'after' };
  const k = blockIndex(day, start);
  const br = breakForBlock(k, semester);
  if (br) return { status: 'break', label: br.label };
  let week = 1;
  for (let i = 0; i < k; i++) if (!breakForBlock(i, semester)) week++;
  return { status: 'active', week };
}

export function totalWeeks(semester) {
  const start = parseDate(semester.start), end = parseDate(semester.end);
  const blocks = blockIndex(end, start) + 1;
  let n = 0;
  for (let i = 0; i < blocks; i++) if (!breakForBlock(i, semester)) n++;
  return n;
}

const minutes = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };

export function todayClasses(date, schedule) {
  const now = date.getHours() * 60 + date.getMinutes();
  return schedule
    .filter(s => s.day === date.getDay() && minutes(s.end) > now)
    .sort((a, b) => minutes(a.start) - minutes(b.start));
}

export function nextClass(date, schedule) {
  if (!schedule.length) return null;
  const now = date.getHours() * 60 + date.getMinutes();
  for (let offset = 0; offset < 8; offset++) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
    const cands = schedule
      .filter(s => s.day === d.getDay() && (offset > 0 || minutes(s.start) > now))
      .sort((a, b) => minutes(a.start) - minutes(b.start));
    if (cands.length) return { item: cands[0], date: d };
  }
  return null;
}

export function upcoming(date, items, field = 'due') {
  const today = startOfDay(date);
  return items
    .filter(i => i[field] && parseDate(i[field]) >= today)
    .sort((a, b) => parseDate(a[field]) - parseDate(b[field]));
}

export function daysUntil(date, target) {
  return Math.ceil((startOfDay(target) - startOfDay(date)) / DAY);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/`
Expected: all tests PASS. (If `totalWeeks` ≠ 13, recount: 2026-10-25 → 2027-01-29 is blocks 0..13 = 14 blocks; block 2 (2026-11-08..12) is break → 13.)

- [ ] **Step 5: Commit**

```bash
git add sem-a/lib.js tests/lib.test.mjs
git commit -m "feat(sem-a): pure date/schedule logic with tests"
```

---

### Task 2: סכמת הנתונים + validator — `tools/validate.mjs`

**Files:**
- Create: `tools/validate.mjs`
- Create: `tests/validate.test.mjs`
- Create: `sem-a/data.json` (skeleton בלבד; נמלא ב-Task 3–4)

**Interfaces:**
- Consumes: `parseDate` מ-Task 1.
- Produces: `validate(data) → string[]` (רשימת שגיאות, ריקה = תקין). CLI: `node tools/validate.mjs sem-a/data.json` → exit 0/1.

סכמה (מעדכנת את `weekly` בספק: במקום `readings` — `items` עם tag, כמו ב-Countdown הקיים):

```json
{
  "generated": "2026-10-18T00:00:00+03:00",
  "semester": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "breaks": [{ "from": "", "to": "", "label": "" }] },
  "courses": [{ "id": "abnormal", "name": "פסיכולוגיה אבנורמלית א׳", "color": "#e67e22", "lecturer": "" }],
  "schedule": [{ "course": "abnormal", "day": 1, "start": "10:00", "end": "12:00", "type": "lecture", "room": "", "source": "portal" }],
  "exams": [{ "course": "abnormal", "moed": "A", "date": "YYYY-MM-DD", "time": "09:00", "source": "portal" }],
  "assignments": [{ "course": "abnormal", "title": "", "due": "YYYY-MM-DD", "weight": "20%", "source": "syllabus" }],
  "weekly": [{ "week": 1, "course": "abnormal", "topic": "", "items": [{ "text": "", "tag": "קריאה" }], "source": "syllabus" }]
}
```

`type` ∈ `lecture|practice|workshop|seminar`. `tag` ∈ `קריאה|סרטון|מטלה|בוחן|שיעור|תרגול|פרזנטציה|צפייה`. שדות אופציונליים: `lecturer`, `room`, `time`, `weight`, `topic`, `items`.

- [ ] **Step 1: Write the failing test**

```js
// tests/validate.test.mjs
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/`
Expected: FAIL — cannot find `tools/validate.mjs`

- [ ] **Step 3: Write minimal implementation**

```js
// tools/validate.mjs
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
  const common = (arr, name, extra) => (d[name] || []).forEach((x, i) => {
    const p = `${name}[${i}]`;
    req(ids.has(x.course), `${p}.course unknown: ${x.course}`);
    req(SOURCES.includes(x.source), `${p}.source: ${x.source}`);
    extra(x, p);
  });
  common(null, 'schedule', (x, p) => {
    req(Number.isInteger(x.day) && x.day >= 0 && x.day <= 6, `${p}.day`);
    req(TIME.test(x.start), `${p}.start`);
    req(TIME.test(x.end) && x.end > x.start, `${p}.end`);
    req(TYPES.includes(x.type), `${p}.type`);
  });
  common(null, 'exams', (x, p) => {
    req(['A', 'B'].includes(x.moed), `${p}.moed`);
    req(DATE.test(x.date), `${p}.date`);
    req(x.time === undefined || TIME.test(x.time), `${p}.time`);
  });
  common(null, 'assignments', (x, p) => {
    req(x.title, `${p}.title`);
    req(DATE.test(x.due), `${p}.due`);
  });
  common(null, 'weekly', (x, p) => {
    req(Number.isInteger(x.week) && x.week >= 1, `${p}.week`);
    (x.items || []).forEach((it, j) => req(it.text && TAGS.includes(it.tag), `${p}.items[${j}].tag/text`));
  });
  return e;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errs = validate(JSON.parse(readFileSync(process.argv[2], 'utf8')));
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  console.log('data.json OK');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/`
Expected: all PASS (Task 1 + Task 2).

- [ ] **Step 5: Create skeleton `sem-a/data.json`** — זהה ל-`ok()` מהבדיקה אך עם המערכים ריקים ו-courses ריק, `semester` עם התאריכים מהמרכז האישי יחליף אותו ב-Task 3. כרגע:

```json
{ "generated": "", "semester": { "start": "2026-10-25", "end": "2027-01-29", "breaks": [] },
  "courses": [], "schedule": [], "exams": [], "assignments": [], "weekly": [] }
```

Run: `node tools/validate.mjs sem-a/data.json` → `data.json OK`

- [ ] **Step 6: Commit**

```bash
git add tools/validate.mjs tests/validate.test.mjs sem-a/data.json
git commit -m "feat(sem-a): data schema validator + skeleton data.json"
```

---

### Task 3: איסוף מהמרכז האישי ומ-Apple Calendar

**Files:**
- Create: `sem-a/raw/portal.json`, `sem-a/raw/calendar.json` (ממצאים גולמיים, באותה סכמה כמו data.json אבל כל פריט עם `source` של המקור)
- לא לעשות commit ל-`sem-a/raw/` אם יש בו פרטים אישיים מעבר ללו״ז — להוסיף `sem-a/raw/` ל-`.gitignore`.

**Interfaces:**
- Produces: שני קבצים שעוברים `validate` (ב-`courses` אפשר להשאיר מערך זהה לזה שב-Task 4).

- [ ] **Step 1: המרכז האישי (Claude in Chrome).** לטעון את כלי `mcp__claude-in-chrome__*` (קריאת skill `anthropic-skills:chrome-browser` קודם). לפתוח טאב חדש למרכז האישי של רייכמן. אם מופיע מסך התחברות — לעצור ולבקש מהמשתמש להתחבר בעצמו. לקרוא (get_page_text / read_page בלבד, בלי לשלוח טפסים): מערכת שעות, מועדי בחינות א׳/ב׳, מטלות, לוח שנה אקדמי (תחילת/סוף סמסטר א׳, חגים וחופשות). לרשום ב-`sem-a/raw/portal.json` עם `source: "portal"`.
- [ ] **Step 2: Apple Calendar.** לטעון `mcp__plugin_che-ical-mcp_ical__list_calendars` + `list_events`. לקרוא אירועים בטווח `semester.start`–`semester.end`+30 יום (למועדי ב׳). לקחת רק אירועים אקדמיים (שם קורס, "הגשה", "מבחן", "בוחן", "התנסות", "הונרס"). לרשום ב-`sem-a/raw/calendar.json` עם `source: "calendar"`. לא לשנות שום אירוע.
- [ ] **Step 3: אימות**

Run: `node tools/validate.mjs sem-a/raw/portal.json && node tools/validate.mjs sem-a/raw/calendar.json`
Expected: OK לשניהם.

- [ ] **Step 4: Commit** (רק `.gitignore`)

```bash
echo "sem-a/raw/" >> .gitignore && git add .gitignore && git commit -m "chore: ignore raw source extracts"
```

---

### Task 4: סילבוסים + מיזוג → `sem-a/data.json` + `sem-a/conflicts.md`

**Files:**
- Create: `sem-a/raw/syllabus.json`
- Modify: `sem-a/data.json`
- Create: `sem-a/conflicts.md`

**Interfaces:**
- Consumes: `sem-a/raw/{portal,calendar}.json` (Task 3), validator (Task 2).
- Produces: `sem-a/data.json` מלא ותקין.

סילבוסים (7):
- `~/Desktop/תואר ראשון - פסיכולוגיה/שנה ג׳/סמסטר א׳/<קורס>/סילבוס/*.pdf` × 6 (רב-משתנית: בירנבוים; ספורט: הקובץ בתיקיית הקורס — אם יש שני עותקים, להעדיף `...סילבוס תשפז.pdf` ולציין הבדלים ב-conflicts)
- `~/Desktop/תואר ראשון - פסיכולוגיה/Honors/Third Year/סמינר מחקרי הונרס שנה ג׳/סילבוס/*.pdf`

course ids: `abnormal`, `multivariate`, `sport`, `ethics-ai`, `pbls`, `skills-field`, `honors`. צבעים: `abnormal #e67e22`, `multivariate #3f51b5`, `sport #27ae60`, `ethics-ai #8e44ad`, `pbls #2980b9`, `skills-field #16a085`, `honors #b8860b`.

- [ ] **Step 1:** לקרוא כל סילבוס במלואו (Read עם `pages`). לחלץ ל-`sem-a/raw/syllabus.json`: לו״ז שבועי (week, topic, items עם tag), מטלות + משקל + תאריך אם כתוב, מבחנים/בחנים. סילבוס שכתוב בו תאריך ולא מספר שבוע → להמיר למספר שבוע עם `weekInfo` (Task 1) מול `semester` מהמרכז האישי.
- [ ] **Step 2: מיזוג.** לכל קורס+סוג: לפתור לפי portal ← calendar ← syllabus. פריטים זהים (אותו קורס, כותרת דומה, תאריך ±0) מתמזגים לאחד עם המקור בעל העדיפות. כל מקרה שבו המקורות נותנים ערכים שונים → שורה ב-`conflicts.md`:

```markdown
| קורס | פריט | portal | calendar | syllabus | נבחר |
|---|---|---|---|---|---|
```

- [ ] **Step 3: אימות**

Run: `node tools/validate.mjs sem-a/data.json && node --test tests/`
Expected: `data.json OK`, כל הבדיקות עוברות.

- [ ] **Step 4: בדיקת דגימה ידנית** — לכל קורס: מבחן מועד א׳ אחד מול המרכז האישי; 3 מטלות אקראיות מול המקור שלהן. לתקן אי-התאמות.
- [ ] **Step 5: להציג למשתמש את `conflicts.md` ולחכות לאישור** לפני Task 6 (push).
- [ ] **Step 6: Commit**

```bash
git add sem-a/data.json sem-a/conflicts.md
git commit -m "feat(sem-a): populate semester data from portal, calendar, syllabi"
```

---

### Task 5: תצוגה — `sem-a/index.html`

**Files:**
- Create: `sem-a/index.html`
- Create: `.claude/launch.json` (שרת מקומי לבדיקה)

**Interfaces:**
- Consumes: כל הפונקציות מ-`sem-a/lib.js`; `sem-a/data.json`.

מבנה הדף (RTL, CSS מועתק מ-`index.html` השורש — `:root`, `.box`, `.header`, `.item-row`, `.timer`, `.bg-*`, `.badge`, `.tag-*`, `.done`, `.nav-btn`, `.inputs`, `.btn-add`, `.del-btn`, `.course-label`):

1. `top-bar`: כותרת "לו״ז שנה ג׳ · סמסטר א׳" + `#date-display` ("יום ב׳ 26.10 · שבוע 2/13" או "חופשה: …" או "הסמסטר מתחיל בעוד N ימים").
2. `#today` (רוחב מלא, מעל ה-container): שיעורי היום (`todayClasses`) — שעה · קורס (תווית צבע) · סוג · חדר אם יש. אם ריק: "אין עוד שיעורים היום · הבא: <קורס> <יום> <שעה>" (`nextClass`). מימין: "הגשה הבאה" (`upcoming(assignments,'due')[0]`) + "מבחן הבא" (`upcoming(exams,'date')[0]`) עם `daysUntil`.
3. `.box` מבחנים: כל `exams` + ידניים, ממוינים; `.timer` אדום ≤7 ימים, ירוק מעבר, `bg-passed` אם עבר. tag `מבחן` / `מועד-ב`.
4. `.box` מטלות: `assignments` + ידניים, ממוינים לפי `due`, אותה לוגיקת צבע, checkbox done.
5. `.box` תוכן שבועי: nav ‹ › בין שבועות 1..`totalWeeks`; ברירת מחדל = שבוע נוכחי (או 1 לפני הסמסטר, אחרון אחריו); קבוצה לכל קורס עם `.course-label` בצבע הקורס; checkbox done לכל item.

localStorage (try/catch על כל גישה): `sem_a_done` (map key→bool, key = `w{week}_{course}_{i}` / `a_{course}_{title}` ), `sem_a_user_exams`, `sem_a_user_tasks`, `sem_a_user_weekly`.

טעינה:

```html
<script type="module">
import { parseDate, weekInfo, totalWeeks, todayClasses, nextClass, upcoming, daysUntil } from './lib.js';
let data;
try {
  const r = await fetch('./data.json', { cache: 'no-store' });
  if (!r.ok) throw new Error(r.status);
  data = await r.json();
} catch (e) {
  document.body.innerHTML = '<div class="box" style="margin:40px auto;padding:20px;text-align:center">לא הצלחתי לטעון את הלו״ז (data.json). בדוק חיבור לאינטרנט.</div>';
  throw e;
}
// render(), and setInterval(render, 60_000) so "today" stays current on the desktop
</script>
```

כל שדה אופציונלי מוצג רק אם קיים (`x.room ? ' · ' + x.room : ''`).

- [ ] **Step 1:** לכתוב את `sem-a/index.html` לפי המבנה למעלה.
- [ ] **Step 2:** `.claude/launch.json`:

```json
{ "version": "0.0.1", "configurations": [
  { "name": "countdown", "runtimeExecutable": "python3", "runtimeArgs": ["-m", "http.server", "8765"], "port": 8765 } ] }
```

- [ ] **Step 3: בדיקה בדפדפן** — `preview_start` עם `countdown`, לנווט ל-`http://localhost:8765/sem-a/`. לוודא: אין שגיאות קונסול; `#date-display` נכון להיום (2026-10-18 → לפני הסמסטר אם start מאוחר יותר); ניווט שבועות עובד; סימון done שורד רענון.
- [ ] **Step 4: Review Focus #1/#5** — ב-console להריץ `render(new Date('<תאריך בחופשה>T10:00'))` ו-`render(new Date('<יום עם שיעורים>T20:00'))` (לחשוף `window.render` שמקבל תאריך אופציונלי) ולוודא את הטקסטים "חופשה: …" ו-"אין עוד שיעורים היום · הבא: …".
- [ ] **Step 5: Review Focus #4** — לשנות זמנית את ה-fetch ל-`./nope.json`, לוודא הודעת שגיאה, להחזיר.
- [ ] **Step 6: Commit**

```bash
git add sem-a/index.html .claude/launch.json
git commit -m "feat(sem-a): schedule page with today strip, exams, tasks, weekly view"
```

---

### Task 6: פרסום + Plash

**Files:** אין קבצים חדשים.

- [ ] **Step 1:** לוודא שהמשתמש אישר את `conflicts.md` (Task 4 Step 5).
- [ ] **Step 2: Push** (לבקש אישור מהמשתמש לפני — פעולה חיצונית):

```bash
git push origin main
```

- [ ] **Step 3:** לחכות ל-GitHub Pages ולאמת:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://amatidoge.github.io/Countdown/sem-a/
curl -s https://amatidoge.github.io/Countdown/sem-a/data.json | head -c 200
```

Expected: `200` ו-JSON.
- [ ] **Step 4: Plash.** לבקש מהמשתמש: Plash → Add Website → `https://amatidoge.github.io/Countdown/sem-a/` → להפוך לנוכחי. (לא לערוך את ה-defaults של Plash מבחוץ — זה שינוי הגדרות אפליקציה; המשתמש מוסיף בעצמו.) לאמת עם צילום מסך של ה-desktop אם המשתמש מאשר computer-use.
- [ ] **Step 5:** לוודא `index.html` של סמסטר ב׳ עדיין נטען: `curl -s -o /dev/null -w "%{http_code}\n" https://amatidoge.github.io/Countdown/` → `200`.

---

## רענון עתידי ("תרענן")

Task 3 → Task 4 (Steps 1–6) → push. `index.html` ו-`lib.js` לא משתנים.
