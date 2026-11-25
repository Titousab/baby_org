/** Age ranges in months, taken exactly as the place writes them (spec §7.2b). */
export type AgeRange = { min: number | null; max: number | null };

// A unit must end at a word boundary, so "Moms" isn't read as months.
const UNIT = String.raw`(?:(months?|mos?|years?|yrs?)\b\.?)`;
const NUM = String.raw`(\d+(?:\.\d+)?)`;

const toMonths = (n: number, unit: string) => Math.round(/^mo/i.test(unit) ? n : n * 12);

/**
 * "18 months to 3 years" → 18–36, "Ages 1–2" → 12–24, "18 mos.-3 yrs." → 18–36, "Under 5" → 0–59,
 * "Ages 3+" / "2 years and older" → that age and up. Several ranges ("babies 0-12 months and
 * toddlers 1-3 years") give the span they cover together. Numbers with no unit count as years
 * only when the text says "age(s)", so times and dates are never mistaken for ages.
 */
export function parseAgeText(text: string): AgeRange | null {
  const t = text.replace(/[–—]/g, '-');
  const defaultUnit = /\bages?\b/i.test(t) ? 'years' : null;

  const ranges: AgeRange[] = [];
  const rangeRe = new RegExp(String.raw`${NUM}\s*${UNIT}?\s*(?:-|to)\s*${NUM}\s*${UNIT}?`, 'gi');
  for (const [, a, unitA, b, unitB] of t.matchAll(rangeRe)) {
    const lowUnit = unitA ?? unitB ?? defaultUnit;
    const highUnit = unitB ?? unitA ?? defaultUnit;
    if (!lowUnit || !highUnit) continue;
    ranges.push({ min: toMonths(Number(a), lowUnit), max: toMonths(Number(b), highUnit) });
  }
  if (ranges.length) {
    return { min: Math.min(...ranges.map((r) => r.min!)), max: Math.max(...ranges.map((r) => r.max!)) };
  }

  const under = new RegExp(String.raw`\bunder\s+${NUM}\s*${UNIT}?`, 'i').exec(t);
  if (under) return { min: 0, max: toMonths(Number(under[1]), under[2] ?? 'years') - 1 };

  const plus = new RegExp(String.raw`${NUM}\s*${UNIT}?\s*(?:\+|and up\b|and older\b|or older\b|and over\b)`, 'i').exec(t);
  if (plus) return { min: toMonths(Number(plus[1]), plus[2] ?? 'years'), max: null };
  return null;
}

const yrs = (m: number) => `${Number.isInteger(m / 12) ? m / 12 : (m / 12).toFixed(1)}`;

/** "12–24 mo", "0–4 yrs", "18 mo – 3 yrs", "3 yrs and up", "Age not listed". */
export function ageLabel(min: number | null, max: number | null): string {
  if (min === null && max === null) return 'Age not listed';
  if (max === null) return min! % 12 === 0 ? `${yrs(min!)} yrs and up` : `${min} mo and up`;
  const lo = min ?? 0;
  if (max <= 24) return `${lo}–${max} mo`;
  if (lo % 12 === 0) return `${yrs(lo)}–${yrs(max)} yrs`;
  return `${lo} mo – ${yrs(max)} yrs`;
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
