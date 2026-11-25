import { getDb } from '@/db/client';
import { isFamily } from '@/lib/auth/permissions';
import type { SessionUser } from '@/lib/auth/session';
import { listPeople } from '@/lib/people';
import { getSettings } from '@/lib/settings';
import { AccountButton } from './account/AccountButton';

/** The round initial in each header. Family members also get people and settings in the sheet it opens. */
export async function AvatarButton({ user }: { user: SessionUser }) {
  if (!isFamily(user)) return <AccountButton user={user} people={null} settings={null} />;
  const db = await getDb();
  const [people, settings] = await Promise.all([listPeople(db), getSettings(db)]);
  return <AccountButton user={user} people={people} settings={settings} />;
}
