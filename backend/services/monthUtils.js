'use strict';

// Pure date helpers for the monthly rollover (no database / framework dependencies).
// Month keys look like "2026-11". They sort correctly as plain strings.

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// The month boundary is decided in this time zone (Render servers run in UTC, users are in India).
const DEFAULT_TZ = process.env.APP_TIMEZONE || 'Asia/Kolkata';

const KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const pad2 = (n) => String(n).padStart(2, '0');
const isValidMonthKey = (key) => typeof key === 'string' && KEY_PATTERN.test(key);

const makeKey = (year, month1to12) => `${year}-${pad2(month1to12)}`;

// Year/month of an instant, as seen in the given time zone
const partsInZone = (date, tz = DEFAULT_TZ) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit' })
    .formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year').value);
  const month = Number(parts.find((p) => p.type === 'month').value);
  return { year, month };
};

const currentMonthKey = (now = new Date(), tz = DEFAULT_TZ) => {
  const { year, month } = partsInZone(now, tz);
  return makeKey(year, month);
};

// Month key of an expense "date" value. Accepts "YYYY-MM-DD", ISO strings, epoch ms,
// Date objects and Firestore Timestamps. Returns null when the value cannot be understood.
const monthKeyOfDate = (value, tz = DEFAULT_TZ) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') {
    // A bare calendar date has no time zone: use it as written
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (m) return isValidMonthKey(`${m[1]}-${m[2]}`) ? `${m[1]}-${m[2]}` : null;
  }
  let d;
  if (value && typeof value.toDate === 'function') d = value.toDate();
  else if (value instanceof Date) d = value;
  else if (typeof value === 'number' || typeof value === 'string') d = new Date(value);
  else return null;
  if (Number.isNaN(d.getTime())) return null;
  const { year, month } = partsInZone(d, tz);
  return makeKey(year, month);
};

// Month key of a salary record ({ month: "November", year: 2026 })
const monthKeyOfSalary = (salary) => {
  if (!salary) return null;
  const idx = MONTH_NAMES.findIndex((m) => m.toLowerCase() === String(salary.month || '').trim().toLowerCase());
  const year = Number(salary.year);
  if (idx < 0 || !Number.isInteger(year) || year < 1970 || year > 2200) return null;
  return makeKey(year, idx + 1);
};

const parseKey = (key) => {
  const [y, m] = key.split('-').map(Number);
  return { year: y, monthIndex: m - 1 };
};

const labelOfKey = (key) => {
  const { year, monthIndex } = parseKey(key);
  return `${MONTH_NAMES[monthIndex]} ${year}`;
};

const toIso = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
};

module.exports = {
  MONTH_NAMES,
  DEFAULT_TZ,
  isValidMonthKey,
  makeKey,
  currentMonthKey,
  monthKeyOfDate,
  monthKeyOfSalary,
  parseKey,
  labelOfKey,
  toIso,
};
