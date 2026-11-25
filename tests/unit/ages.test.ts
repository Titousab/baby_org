import { describe, expect, test } from 'vitest';
import { ageInMonths, fitFor, parseAgeText } from '@/lib/classes/ages';

describe('parseAgeText takes ages as written', () => {
  test.each([
    ['This program is for little ones, 18 months to 3 years, and their caregivers.', { min: 18, max: 36 }],
    ['1 – 2 yrs', { min: 12, max: 24 }],
    ['Ages: 1.5-3 years old', { min: 18, max: 36 }],
    ['0 mo – 1 yrs', { min: 0, max: 12 }],
    ['3 mo – 1.5 yrs', { min: 3, max: 18 }],
    ['6 to 24 months', { min: 6, max: 24 }],
    ['Ages 3+', { min: 36, max: null }],
  ])('%s', (text, expected) => {
    expect(parseAgeText(text)).toEqual(expected);
  });

  test('words without numbers are unknown', () => {
    expect(parseAgeText('Toddlers welcome')).toBeNull();
    expect(parseAgeText('')).toBeNull();
  });
});

describe('ageInMonths', () => {
  test('whole months, counting the day of the month', () => {
    expect(ageInMonths('2025-06-10', '2026-11-25')).toBe(17);
    expect(ageInMonths('2025-06-10', '2026-12-09')).toBe(17);
    expect(ageInMonths('2025-06-10', '2026-12-10')).toBe(18);
  });
});

describe('fitFor', () => {
  test("fits, or the class is for older or younger kids than Ezra, or unknown", () => {
    expect(fitFor({ min: 18, max: 36 }, 17)).toBe('older');
    expect(fitFor({ min: 18, max: 36 }, 18)).toBe('fits');
    expect(fitFor({ min: 0, max: 12 }, 17)).toBe('younger');
    expect(fitFor({ min: 36, max: null }, 17)).toBe('older');
    expect(fitFor(null, 17)).toBe('unknown');
    expect(fitFor({ min: 12, max: 24 }, null)).toBe('unknown');
  });
});
