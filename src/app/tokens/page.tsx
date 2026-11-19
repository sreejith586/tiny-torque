import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/domain/identity';
import { getEarnedBalance, listActivePacks } from '@/domain/tokens';
import { isFlagEnabled } from '@/domain/flags';
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
        <TokensStoreView
          balance={FIXTURE_PROFILE.tokens}
          packs={FIXTURE_PACKS}
          earnedBalance={12}
        />
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/tokens');

  const [profile, packs, earnedBalance] = await Promise.all([
    getProfile(supabase, user.id),
    listActivePacks(supabase),
    getEarnedBalance(supabase, user.id).catch(() => 0),
  ]);
  if (!profile) redirect('/onboarding');

  // D-024 / D-018: the Buy buttons follow the same `token_purchase` kill switch the server
  // action enforces — otherwise a pilot user sees prices for something that refuses to sell.
  const purchasesOpen = await isFlagEnabled(supabase, 'token_purchase', {
    userId: user.id,
    plan: profile.plan === 'pro' ? 'pro' : 'free',
    countryCode: profile.country_code ?? undefined,
  }).catch(() => false);

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">Tokens</h1>
      <p className="page-sub">
        {purchasesOpen
          ? 'Buy tokens to spend on listing slots, scan packs, and Pro.'
          : 'Spend tokens on listing slots, scan packs, and Pro.'}
      </p>
      <TokensStoreView
        balance={profile.tokens}
        packs={packs}
        earnedBalance={earnedBalance}
        purchasesOpen={purchasesOpen}
      />
    </main>
  );
}
