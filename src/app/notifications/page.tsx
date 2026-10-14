import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listNotifications } from '@/domain/notifications';
import NotificationsListView from '@/components/NotificationsListView';

export const metadata: Metadata = {
  title: 'Notifications',
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/notifications');

  const notifications = await listNotifications(supabase, user.id);

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">Notifications</h1>
      <p className="page-sub">What&apos;s new since you last checked.</p>
      <NotificationsListView initialNotifications={notifications} viewerId={user.id} />
    </main>
  );
}
