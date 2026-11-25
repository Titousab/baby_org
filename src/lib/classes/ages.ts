/** Age ranges in months, taken exactly as the place writes them (spec §7.2b). */
export type AgeRange = { min: number | null; max: number | null };

const UNIT = String.raw`(months?|mos?|mo|years?|yrs?|yr)`;
const NUM = String.raw`(\d+(?:\.\d+)?)`;

const toMonths = (n: number, unit: string | undefined) => Math.round(/^m/i.test(unit ?? '') ? n : n * 12);

/**
 * "18 months to 3 years" → 18–36, "1 – 2 yrs" → 12–24, "Ages 3+" → 36 and up.
 * A bare number range takes the unit written after it ("6 to 24 months" → months).
 */
export function parseAgeText(text: string): AgeRange | null {
  const t = text.replace(/–|—/g, '-');

  const range = new RegExp(String.raw`${NUM}\s*${UNIT}?\s*(?:-|to)\s*${NUM}\s*${UNIT}`, 'i').exec(t);
  if (range) {
    const [, a, unitA, b, unitB] = range;
    return { min: toMonths(Number(a), unitA ?? unitB), max: toMonths(Number(b), unitB) };
  }

  const plus = new RegExp(String.raw`${NUM}\s*${UNIT}?\s*(?:\+|and up|or older)`, 'i').exec(t);
  if (plus && /age|month|year|yr|mo\b|\+/i.test(t)) {
    const [, a, unit] = plus;
    return { min: toMonths(Number(a), unit ?? 'years'), max: null };
  }
  return null;
}

/** Whole months between a birthdate and a day, both 'YYYY-MM-DD'. */
export function ageInMonths(birthdate: string, onDate: string): number {
  const [by, bm, bd] = birthdate.split('-').map(Number);
  const [y, m, d] = onDate.split('-').map(Number);
  return (y - by) * 12 + (m - bm) - (d < bd ? 1 : 0);
}

/** Whether a class suits Ezra at `months` old; 'older'/'younger' say who the class is for instead. */
export function fitFor(ages: AgeRange | null, months: number | null): 'fits' | 'older' | 'younger' | 'unknown' {
  if (!ages || months === null || (ages.min === null && ages.max === null)) return 'unknown';
  if (ages.min !== null && months < ages.min) return 'older';
  if (ages.max !== null && months > ages.max) return 'younger';
  return 'fits';
}
