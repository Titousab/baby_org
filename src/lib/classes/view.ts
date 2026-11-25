import { fmtTime, minutesNowNY, monthDay, todayNY } from '@/lib/time';
import { ageInMonths, fitFor } from './ages';
import type { ClassItem } from './list';

/** Nearby ideas worth showing: ones that fit Ezra's age, or whose ages aren't known. */
export function visibleIdeas(items: ClassItem[], birthdate: string | null): ClassItem[] {
  return items.filter((i) => {
    if (i.kind !== 'idea') return false;
    const fit = fitFor({ min: i.ageMin, max: i.ageMax }, birthdate ? ageInMonths(birthdate, i.date) : null);
    return fit === 'fits' || fit === 'unknown';
  });
}

/** "6:02 am" for today, otherwise "Nov 24". */
export function whenLabel(at: Date, today: string): string {
  return todayNY(at) === today ? fmtTime(minutesNowNY(at)) : monthDay(todayNY(at));
}

/** What the places sheet says about where a place's classes come from, and how fresh they are. */
export function placeStatusLine(source: { lastSuccessAt: Date | null; lastError: string | null } | null, today: string): string {
  if (!source) return 'Typed in by hand';
  if (source.lastError) {
    return source.lastSuccessAt ? `${source.lastError} Last read ${whenLabel(source.lastSuccessAt, today)}.` : source.lastError;
  }
  if (source.lastSuccessAt) return `Updates automatically · checked ${whenLabel(source.lastSuccessAt, today)}`;
  return 'Updates automatically · not checked yet';
}
