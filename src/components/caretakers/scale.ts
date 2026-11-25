import type { CoverageRules } from '@/lib/schedule/coverage';
import { dayOfWeek, fmtRange, toMin } from '@/lib/time';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** '8a', '12p', '6:30p' — the labels under the coverage bars. */
export function shortClock(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h % 12 || 12}${mm ? `:${String(mm).padStart(2, '0')}` : ''}${h < 12 ? 'a' : 'p'}`;
}

/** Positions (percent of the window) and labels: the window's ends, plus noon and 4 pm when they fit. */
export function scaleTicks(rules: CoverageRules): Array<{ pct: number; label: string }> {
  const a = toMin(rules.start);
  const b = toMin(rules.end);
  const pct = (m: number) => ((m - a) / (b - a)) * 100;
  const inner = [720, 960].filter((m) => m - a >= 120 && b - m >= 120);
  return [a, ...inner, b].map((m) => ({ pct: pct(m), label: shortClock(m) }));
}

/** Left/width percentages of a span inside the window, or null if it falls outside. */
export function barSpan(rules: CoverageRules, start: number, end: number): { left: number; width: number } | null {
  const a = toMin(rules.start);
  const b = toMin(rules.end);
  const l = Math.max(start, a);
  const r = Math.min(end, b);
  if (r <= l) return null;
  return { left: ((l - a) / (b - a)) * 100, width: ((r - l) / (b - a)) * 100 };
}

/** 'Needed weekdays, 8:00 am – 6:30 pm'. */
export function coverageLine(rules: CoverageRules): string {
  const days = [...rules.days].sort((x, y) => x - y).join(',');
  const which = days === '1,2,3,4,5' ? 'weekdays' : days === '0,1,2,3,4,5,6' ? 'every day' : rules.days.map((d) => DOW[d]).join(', ');
  return `Needed ${which}, ${fmtRange(rules.start, rules.end)}`;
}

export const isWeekend = (date: string) => [0, 6].includes(dayOfWeek(date));
