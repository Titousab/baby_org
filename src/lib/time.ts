/**
 * Everything in the app runs on New York time, whatever zone the server or phone is in.
 * Dates are 'YYYY-MM-DD' strings and times are 'HH:MM' (24h) strings.
 * Date math is done on UTC midnights so daylight-saving changes never shift a day.
 */

export const TZ = 'America/New_York';

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const nyParts = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function partsNY(now: Date) {
  const get = (type: string) => nyParts.formatToParts(now).find((p) => p.type === type)?.value ?? '00';
  return { y: get('year'), m: get('month'), d: get('day'), h: Number(get('hour')), min: Number(get('minute')) };
}

export function todayNY(now: Date = new Date()): string {
  const { y, m, d } = partsNY(now);
  return `${y}-${m}-${d}`;
}

export function minutesNowNY(now: Date = new Date()): number {
  const { h, min } = partsNY(now);
  return h * 60 + min;
}

function toUTC(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(x: Date): string {
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`;
}

export function addDays(date: string, n: number): string {
  const x = toUTC(date);
  x.setUTCDate(x.getUTCDate() + n);
  return fromUTC(x);
}

export function dayOfWeek(date: string): number {
  return toUTC(date).getUTCDay();
}

export function weekStartOf(date: string): string {
  return addDays(date, -((dayOfWeek(date) + 6) % 7));
}

export function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function fromMin(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

const asMin = (v: string | number) => (typeof v === 'number' ? v : toMin(v));

function clock(m: number, withAmPm: boolean): string {
  const h = Math.floor(m / 60) % 24;
  const s = `${h % 12 || 12}:${String(m % 60).padStart(2, '0')}`;
  return withAmPm ? `${s} ${h < 12 ? 'am' : 'pm'}` : s;
}

export function fmtTime(t: string | number): string {
  return clock(asMin(t), true);
}

export function fmtRange(a: string | number, b: string | number): string {
  const x = asMin(a);
  const y = asMin(b);
  const sameHalf = x < 720 === y < 720;
  return sameHalf ? `${clock(x, false)} – ${clock(y, true)}` : `${clock(x, true)} – ${clock(y, true)}`;
}

export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}

export function fmtHours(min: number): string {
  const h = min / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)}h`;
}

export function fmtWeekRange(weekStart: string): string {
  const a = toUTC(weekStart);
  const b = toUTC(addDays(weekStart, 6));
  const start = `${MON_SHORT[a.getUTCMonth()]} ${a.getUTCDate()}`;
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${start} – ${b.getUTCDate()}`
    : `${start} – ${MON_SHORT[b.getUTCMonth()]} ${b.getUTCDate()}`;
}

export function fmtDayLong(date: string): string {
  const x = toUTC(date);
  return `${DOW_LONG[x.getUTCDay()]}, ${MON_LONG[x.getUTCMonth()]} ${x.getUTCDate()}`;
}

export function fmtDayShort(date: string): string {
  const x = toUTC(date);
  return `${DOW_SHORT[x.getUTCDay()]}, ${MON_SHORT[x.getUTCMonth()]} ${x.getUTCDate()}`;
}

/** 'Mon' style weekday name. */
export function dowShort(date: string): string {
  return DOW_SHORT[dayOfWeek(date)];
}

/** 'Monday' style weekday name. */
export function dowLong(date: string): string {
  return DOW_LONG[dayOfWeek(date)];
}

/** 'Nov 25' style short date. */
export function monthDay(date: string): string {
  const x = toUTC(date);
  return `${MON_SHORT[x.getUTCMonth()]} ${x.getUTCDate()}`;
}

/** Day of month as a number. */
export function dayNum(date: string): number {
  return toUTC(date).getUTCDate();
}
