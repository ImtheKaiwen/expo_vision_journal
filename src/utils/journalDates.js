/**
 * Günlük `date` alanı: `toLocaleDateString('tr-TR')` → genelde GG.AA.YYYY
 * @returns {{ y: number, m: number, d: number } | null} m ve d 1–12 / 1–31
 */
export function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDisplayDateTr(str) {
  if (!str || typeof str !== 'string') return null;
  const parts = str.trim().split(/[./]/);
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1970 || y > 2100) return null;
  const check = new Date(y, m - 1, d);
  if (check.getFullYear() !== y || check.getMonth() !== m - 1 || check.getDate() !== d) return null;
  return { y, m, d };
}

/** Takvim hücresi: önce `createdAt` (yerel gün), yoksa `date` parse. */
export function entryToYmd(entry) {
  if (entry?.createdAt) {
    const dt = new Date(entry.createdAt);
    if (!Number.isNaN(dt.getTime())) {
      return {
        y: dt.getFullYear(),
        m: dt.getMonth() + 1,
        d: dt.getDate(),
      };
    }
  }
  return parseDisplayDateTr(entry?.date);
}

export function ymdKey({ y, m, d }) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Ay içinde her gün için kayıt sayısı */
export function countEntriesByDay(entries, year, monthIndex) {
  const map = new Map();
  for (const e of entries) {
    const ymd = entryToYmd(e);
    if (!ymd || ymd.y !== year || ymd.m !== monthIndex + 1) continue;
    const k = ymdKey(ymd);
    map.set(k, (map.get(k) || 0) + 1);
  }
  return map;
}

/** Pazartesi ile başlayan hafta satırları; hücre: null | { day: number } */
export function buildCalendarWeeks(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const daysInMonth = last.getDate();
  const startPad = (first.getDay() + 6) % 7;

  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, year, monthIndex });
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

const WEEKDAY_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

export function weekdayLabelsTr() {
  return WEEKDAY_TR;
}

export function formatMonthYearTr(year, monthIndex) {
  const d = new Date(year, monthIndex, 1);
  return d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

export function addCalendarMonths(year, monthIndex, delta) {
  const d = new Date(year, monthIndex + delta, 1);
  return { year: d.getFullYear(), monthIndex: d.getMonth() };
}
