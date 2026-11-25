import { eq } from 'drizzle-orm';
import { settings } from '@/db/schema';
import type { DB } from '@/db/types';
import { ValidationError } from './errors';
import type { CoverageRules } from './schedule/coverage';

export type Settings = { ezraBirthdate: string | null; rules: CoverageRules };

const DEFAULTS = { ezraBirthdate: null, coverageDays: [1, 2, 3, 4, 5], coverageStart: '08:00', coverageEnd: '18:30' };
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function getSettings(db: DB): Promise<Settings> {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  const s = row ?? DEFAULTS;
  return {
    ezraBirthdate: s.ezraBirthdate,
    rules: { days: [...s.coverageDays].sort((a, b) => a - b), start: s.coverageStart, end: s.coverageEnd },
  };
}

type SettingsInput = { ezraBirthdate?: string | null; days?: number[]; start?: string; end?: string };

export async function updateSettings(db: DB, input: SettingsInput): Promise<void> {
  const current = await getSettings(db);
  const next = {
    ezraBirthdate: input.ezraBirthdate === undefined ? current.ezraBirthdate : input.ezraBirthdate || null,
    coverageDays: input.days ?? current.rules.days,
    coverageStart: input.start ?? current.rules.start,
    coverageEnd: input.end ?? current.rules.end,
  };

  if (next.ezraBirthdate && !DATE.test(next.ezraBirthdate)) throw new ValidationError("Pick Ezra's birthday.", 'birthdate');
  if (!next.coverageDays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
    throw new ValidationError('Pick the days someone needs to be with Ezra.', 'days');
  }
  if (!TIME.test(next.coverageStart)) throw new ValidationError('Pick a start time.', 'start');
  if (!TIME.test(next.coverageEnd)) throw new ValidationError('Pick an end time.', 'end');
  if (next.coverageEnd <= next.coverageStart) throw new ValidationError('The end time needs to be after the start time.', 'end');

  await db
    .insert(settings)
    .values({ id: 1, ...next })
    .onConflictDoUpdate({ target: settings.id, set: next });
}
