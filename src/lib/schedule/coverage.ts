import { dayOfWeek, toMin } from '@/lib/time';

export type ShiftView = {
  id: number;
  date: string;
  personId: number;
  personName: string;
  color: string;
  start: string;
  end: string;
};

/** Which weekdays (0 = Sun) and hours someone should be with Ezra. */
export type CoverageRules = { days: number[]; start: string; end: string };

export function needsCoverage(date: string, rules: CoverageRules, daysOff: Map<string, string>): boolean {
  return rules.days.includes(dayOfWeek(date)) && !daysOff.has(date);
}

/** Uncovered spans of the coverage window, in minutes since midnight. */
export function gapsFor(shifts: { start: string; end: string }[], rules: CoverageRules, needed: boolean): Array<[number, number]> {
  if (!needed) return [];
  const windowStart = toMin(rules.start);
  const windowEnd = toMin(rules.end);
  const spans = shifts
    .map((s) => [Math.max(toMin(s.start), windowStart), Math.min(toMin(s.end), windowEnd)] as const)
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);

  const gaps: Array<[number, number]> = [];
  let cursor = windowStart;
  for (const [a, b] of spans) {
    if (a > cursor) gaps.push([cursor, a]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < windowEnd) gaps.push([cursor, windowEnd]);
  return gaps;
}

/** Who has Ezra at `nowMin`, and who takes over after. */
export function nowWithEzra(shifts: ShiftView[], nowMin: number): { current: ShiftView | null; next: ShiftView | null } {
  const sorted = [...shifts].sort((a, b) => toMin(a.start) - toMin(b.start));
  const current = sorted.find((s) => toMin(s.start) <= nowMin && nowMin < toMin(s.end)) ?? null;
  const after = current ? toMin(current.end) : nowMin;
  const next = sorted.find((s) => s !== current && toMin(s.start) >= after) ?? null;
  return { current, next };
}

export function weeklyHours(shifts: ShiftView[]): Array<{ personName: string; color: string; minutes: number }> {
  const totals = new Map<string, { personName: string; color: string; minutes: number }>();
  for (const s of shifts) {
    const t = totals.get(s.personName) ?? { personName: s.personName, color: s.color, minutes: 0 };
    t.minutes += toMin(s.end) - toMin(s.start);
    totals.set(s.personName, t);
  }
  return [...totals.values()].sort((a, b) => b.minutes - a.minutes);
}
