import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/domain/identity';
import { listBlockedUsers, type BlockedUser } from '@/domain/trust';
import SettingsView from '@/components/SettingsView';
import { FIXTURE_PROFILE, isVisualHarness } from '@/lib/visual-fixtures';

export const metadata: Metadata = {
  title: 'Settings',
};

// MV-S8-05 (F-14 Settings). Guarded by proxy.ts (not a public path).
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const header = (
    <>
      <h1 className="page-heading">Settings</h1>
      <p className="page-sub">Account, appearance, privacy and your data.</p>
    </>
  );

  if (isVisualHarness(await searchParams)) {
    return (
      <main style={{ padding: '20px 16px', flex: 1 }}>
        {header}
        <SettingsView profile={FIXTURE_PROFILE} blocked={[]} />
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/settings');
  const profile = await getProfile(supabase, user.id);
  if (!profile) redirect('/onboarding');

  let blocked: BlockedUser[] = [];
  try {
    blocked = await listBlockedUsers(supabase);
  } catch {
    // RPC missing on this environment (migration not applied yet) — show the page without the list
  }

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      {header}
      <SettingsView profile={profile} blocked={blocked} />
    </main>
  );
}
