import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { browseListings } from '@/domain/marketplace';
import MarketView from '@/components/MarketView';
import { FIXTURE_LISTINGS, isVisualHarness } from '@/lib/visual-fixtures';

export const metadata: Metadata = {
  title: 'Market',
};

async function loadFirstPage(harness: boolean) {
  // D-041 baseline harness (non-production): one page of fixtures, no session.
  if (harness) {
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
  // The harness flag reaches us two ways: the `?__visual` query (local/dev) and the x-mv-visual
  // request header the proxy sets (reliable on Vercel, where the anon market route otherwise gets
  // empty searchParams). Reading headers() also opts this route out of static prerendering.
  const sp = await searchParams;
  const hdr = (await headers()).get('x-mv-visual');
  const harnessHeader = hdr === '1';
  const { items, cursor, signedIn, harness } = await loadFirstPage(
    harnessHeader || isVisualHarness(sp)
  );
  const dbg = `dbg h=${String(harness)} hdr=${hdr ?? 'none'} sp=${JSON.stringify(sp)} env=${process.env.VERCEL_ENV ?? 'none'}`;

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <p style={{ fontSize: 10, color: 'red' }}>{dbg}</p>
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
