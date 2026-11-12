import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listNotifications } from '@/domain/notifications';
import NotificationsListView from '@/components/NotificationsListView';
import { FIXTURE_NOTIFICATIONS, FIXTURE_PROFILE } from '@/lib/visual-fixtures';
import { isHarnessRequest } from '@/lib/visual-harness.server';

export const metadata: Metadata = {
  title: 'Notifications',
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // D-056 fixture harness (non-production only, MV-S9-05).
  if (await isHarnessRequest(await searchParams)) {
    return (
      <main style={{ padding: '20px 16px', flex: 1 }}>
        <h1 className="page-heading">Notifications</h1>
        <p className="page-sub">What&apos;s new since you last checked.</p>
        <NotificationsListView
          initialNotifications={FIXTURE_NOTIFICATIONS}
          viewerId={FIXTURE_PROFILE.id}
        />
      </main>
    );
  }

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
