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

// A week block is a break if every Sun–Thu day in it falls inside one break.
function breakForBlock(k, semester) {
  const start = parseDate(semester.start);
  for (const b of semester.breaks || []) {
    const from = parseDate(b.from), to = parseDate(b.to);
    let all = true;
    for (let i = 0; i < 5; i++) {
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

export function isNoClassDay(date, semester) {
  const day = startOfDay(date);
  return (semester?.breaks || []).find(b => day >= parseDate(b.from) && day <= parseDate(b.to)) || null;
}

export function todayClasses(date, schedule, semester) {
  if (isNoClassDay(date, semester)) return [];
  const now = date.getHours() * 60 + date.getMinutes();
  return schedule
    .filter(s => s.day === date.getDay() && minutes(s.end) > now)
    .sort((a, b) => minutes(a.start) - minutes(b.start));
}

export function nextClass(date, schedule, semester) {
  if (!schedule.length) return null;
  const now = date.getHours() * 60 + date.getMinutes();
  for (let offset = 0; offset < 22; offset++) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
    if (isNoClassDay(d, semester)) continue;
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

// Dates the course's main meeting (first lecture/seminar/workshop slot) actually happens.
export function courseMeetings(course, schedule, semester) {
  const slots = schedule.filter(s => s.course === course);
  const main = slots.find(s => s.type !== 'practice') || slots[0];
  if (!main) return [];
  const out = [], end = parseDate(semester.end);
  for (let d = parseDate(semester.start); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))
    if (d.getDay() === main.day && !isNoClassDay(d, semester)) out.push(d);
  return out;
}
