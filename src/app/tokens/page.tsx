import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/domain/identity';
import { listActivePacks } from '@/domain/tokens';
import TokensStoreView from '@/components/TokensStoreView';
import { FIXTURE_PROFILE, FIXTURE_PACKS, isVisualHarness } from '@/lib/visual-fixtures';

export const metadata: Metadata = {
  title: 'Tokens',
};

export default async function TokensPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (isVisualHarness(await searchParams)) {
    return (
      <main style={{ padding: '20px 16px', flex: 1 }}>
        <h1 className="page-heading">Tokens</h1>
        <p className="page-sub">Buy tokens to spend on listing slots, scan packs, and Pro.</p>
        <TokensStoreView balance={FIXTURE_PROFILE.tokens} packs={FIXTURE_PACKS} />
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/tokens');

  const [profile, packs] = await Promise.all([
    getProfile(supabase, user.id),
    listActivePacks(supabase),
  ]);
  if (!profile) redirect('/onboarding');

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">Tokens</h1>
      <p className="page-sub">Buy tokens to spend on listing slots, scan packs, and Pro.</p>
      <TokensStoreView balance={profile.tokens} packs={packs} />
    </main>
  );
}
