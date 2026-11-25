import { AutoRefresh } from '@/components/AutoRefresh';
import { TabBar } from '@/components/TabBar';
import { ToastHost } from '@/components/Toast';
import { requireUser } from '@/lib/auth/current-user';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <ToastHost>
      <main className="screen">{children}</main>
      <TabBar />
      <AutoRefresh />
    </ToastHost>
  );
}
