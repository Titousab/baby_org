import { describe, expect, test } from 'vitest';
import { type CoverageRules, gapsFor, needsCoverage, nowWithEzra, type ShiftView, weeklyHours } from '@/lib/schedule/coverage';

const rules: CoverageRules = { days: [1, 2, 3, 4, 5], start: '08:00', end: '18:30' };

let nextId = 1;
const shift = (personName: string, start: string, end: string, date = '2026-11-25'): ShiftView => ({
  id: nextId++,
  date,
  personId: personName.length,
  personName,
  color: 'sage',
  start,
  end,
});

describe('gapsFor', () => {
  test('one gap after the day shift', () => {
    expect(gapsFor([{ start: '08:00', end: '16:00' }], rules, true)).toEqual([[960, 1110]]);
  });

  test('overlapping and out-of-window shifts make no false gaps', () => {
    expect(
      gapsFor(
        [
          { start: '07:00', end: '09:00' },
          { start: '08:00', end: '16:00' },
          { start: '15:00', end: '20:00' },
        ],
        rules,
        true,
      ),
    ).toEqual([]);
  });

  test('a gap in the middle, an empty day, and a day that needs nobody', () => {
    expect(gapsFor([{ start: '08:00', end: '12:00' }, { start: '13:00', end: '18:30' }], rules, true)).toEqual([[720, 780]]);
    expect(gapsFor([], rules, true)).toEqual([[480, 1110]]);
    expect(gapsFor([], rules, false)).toEqual([]);
  });

  test('shifts entirely outside the window do not count', () => {
    expect(gapsFor([{ start: '19:00', end: '21:00' }], rules, true)).toEqual([[480, 1110]]);
  });
});

describe('needsCoverage', () => {
  test('weekends and days off need no coverage', () => {
    const off = new Map([['2026-11-26', 'Thanksgiving']]);
    expect(needsCoverage('2026-11-25', rules, off)).toBe(true);
    expect(needsCoverage('2026-11-26', rules, off)).toBe(false);
    expect(needsCoverage('2026-11-28', rules, off)).toBe(false);
  });
});

describe('nowWithEzra', () => {
  const day = [shift('Lauren', '08:00', '16:00'), shift('Mom', '16:00', '18:30')];

  test('mid-afternoon: Lauren now, Mom next', () => {
    const r = nowWithEzra(day, 14 * 60 + 30);
    expect(r.current?.personName).toBe('Lauren');
    expect(r.next?.personName).toBe('Mom');
  });

  test('before anyone starts', () => {
    const r = nowWithEzra(day, 7 * 60);
    expect(r.current).toBeNull();
    expect(r.next?.personName).toBe('Lauren');
  });

  test('after everyone has gone', () => {
    expect(nowWithEzra(day, 19 * 60)).toEqual({ current: null, next: null });
  });
});

describe('weeklyHours', () => {
  test('totals per person, most hours first', () => {
    const week = [
      ...['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-27'].map((d) => shift('Lauren', '08:00', '16:00', d)),
      shift('Selina', '16:00', '18:30', '2026-11-23'),
      shift('Selina', '16:00', '18:30', '2026-11-24'),
    ];
    expect(weeklyHours(week)).toEqual([
      { personName: 'Lauren', color: 'sage', minutes: 1920 },
      { personName: 'Selina', color: 'sage', minutes: 300 },
    ]);
  });
});
