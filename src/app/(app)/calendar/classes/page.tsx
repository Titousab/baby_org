import { AvatarButton } from '@/components/AvatarButton';
import { requireUser } from '@/lib/auth/current-user';

export default async function ClassesPage() {
  const user = await requireUser();
  return (
    <>
      <header className="top gut">
        <div className="top-row">
          <h1 className="title">Calendar</h1>
          <AvatarButton user={user} />
        </div>
      </header>
      <div className="content gut">
        <div className="empty">
          <p className="empty-t">Classes are coming next.</p>
          <p>Your places&apos; schedules will show up here.</p>
        </div>
      </div>
    </>
  );
}
