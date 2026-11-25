import { AvatarButton } from '@/components/AvatarButton';
import { requireUser } from '@/lib/auth/current-user';

export default async function TodayPage() {
  const user = await requireUser();
  return (
    <header className="top gut">
      <div className="top-row">
        <h1 className="title">Ezra&apos;s day</h1>
        <AvatarButton user={user} />
      </div>
    </header>
  );
}
