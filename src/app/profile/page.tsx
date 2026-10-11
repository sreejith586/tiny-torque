import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/domain/identity';
import ProfileView from '@/components/ProfileView';
import { FIXTURE_PROFILE, isVisualHarness } from '@/lib/visual-fixtures';

export const metadata: Metadata = {
  title: 'Profile',
};

async function loadProfile(searchParams: Record<string, string | string[] | undefined>) {
  if (isVisualHarness(searchParams)) return FIXTURE_PROFILE; // D-041 baseline harness, non-production only
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await getProfile(supabase, user.id);
  if (!profile) redirect('/onboarding');
  return profile;
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await loadProfile(await searchParams);

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">Profile</h1>
      <ProfileView profile={profile} />
    </main>
  );
}
