import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { browseListings } from '@/domain/marketplace';
import MarketView from '@/components/MarketView';
import {
  FIXTURE_LISTINGS,
  isVisualHarness,
  harnessAllowed,
  VISUAL_COOKIE,
} from '@/lib/visual-fixtures';

export const metadata: Metadata = {
  title: 'Market',
};

// Browse is per-request (live listings); reading cookies()/headers() below also keeps it off any
// static shell, which is what made the ?__visual baseline render flaky on Vercel.
export const dynamic = 'force-dynamic';

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
  // Detect the harness from any reliable channel: the proxy-set x-mv-visual header, the mv_visual
  // cookie (the dependable one on Vercel for this anon route), or the ?__visual query (local/dev).
  // Reading cookies()/headers() also forces a per-request render (no static shell).
  const sp = await searchParams;
  const harnessHeader = (await headers()).get('x-mv-visual') === '1';
  const harnessCookie = harnessAllowed() && (await cookies()).get(VISUAL_COOKIE)?.value === '1';
  const { items, cursor, signedIn, harness } = await loadFirstPage(
    harnessHeader || harnessCookie || isVisualHarness(sp)
  );

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
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
