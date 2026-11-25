import { schedulePeople } from '@/db/schema';
import type { DB } from '@/db/types';

/** Each person's color by name, for the little dots next to "who saved this". */
export async function colorsByName(db: DB): Promise<Record<string, string>> {
  const rows = await db.select({ name: schedulePeople.name, color: schedulePeople.color }).from(schedulePeople);
  return Object.fromEntries(rows.map((r) => [r.name, r.color]));
}
