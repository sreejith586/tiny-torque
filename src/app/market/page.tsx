import type { Metadata } from 'next';
import { connection } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { browseListings } from '@/domain/marketplace';
import MarketView from '@/components/MarketView';
import { FIXTURE_LISTINGS, isVisualHarness } from '@/lib/visual-fixtures';

export const metadata: Metadata = {
  title: 'Market',
};

export const dynamic = 'force-dynamic';

async function loadFirstPage(searchParams: Record<string, string | string[] | undefined>) {
  // D-041 baseline harness (non-production): one page of fixtures, no session.
  if (isVisualHarness(searchParams)) {
    return { items: FIXTURE_LISTINGS, cursor: null, signedIn: false, harness: true };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let viewerCountry: string | undefined;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('country_code')
      .eq('id', user.id)
      .maybeSingle();
    viewerCountry = profile?.country_code ?? undefined;
  }
  const { items, nextCursor } = await browseListings(supabase, {}, viewerCountry);
  return { items, cursor: nextCursor, signedIn: !!user, harness: false };
}

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // This page reads searchParams (the ?__visual harness flag) + renders per request; opt out of
  // any static prerendering so searchParams is always the real request's (Vercel was otherwise
  // prerendering a shell with empty searchParams — the anon market path never bails to dynamic the
  // way garage's redirect() does).
  await connection();
  const sp = await searchParams;
  const { items, cursor, signedIn, harness } = await loadFirstPage(sp);

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <p data-testid="mkt-debug" style={{ fontSize: 11, color: 'red' }}>
        dbg harness={String(harness)} n={items.length} env={process.env.VERCEL_ENV ?? 'none'} sp=
        {JSON.stringify(sp)}
      </p>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Marketplace</h1>
      <p className="muted" style={{ marginBottom: 12 }}>
        Buy, sell and trade with other collectors.
      </p>
      <MarketView
        initialListings={items}
        initialCursor={cursor}
        signedIn={signedIn}
        harness={harness}
      />
    </main>
  );
}
