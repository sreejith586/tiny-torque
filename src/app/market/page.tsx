import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { browseListings, listFavoriteIds } from '@/domain/marketplace';
import { isFlagEnabled } from '@/domain/flags';
import MarketView from '@/components/MarketView';
import { FIXTURE_LISTINGS } from '@/lib/visual-fixtures';
import { isHarnessRequest } from '@/lib/visual-harness.server';

export const metadata: Metadata = {
  title: 'Market',
};

// Browse is per-request (live listings); reading cookies()/headers() below also keeps it off any
// static shell, which is what made the ?__visual baseline render flaky on Vercel.
export const dynamic = 'force-dynamic';

async function loadFirstPage(harness: boolean) {
  // D-041 baseline harness (non-production): one page of fixtures, no session.
  if (harness) {
    return {
      items: FIXTURE_LISTINGS,
      cursor: null,
      signedIn: false,
      harness: true,
      canPublish: true,
      userId: undefined,
      favoriteIds: [] as string[],
    };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let viewerCountry: string | undefined;
  let canPublish = false;
  let favoriteIds: string[] = [];
  if (user) {
    const [{ data: profile }, publishEnabled, favIds] = await Promise.all([
      supabase.from('profiles').select('country_code').eq('id', user.id).maybeSingle(),
      isFlagEnabled(supabase, 'marketplace_publish', { userId: user.id }),
      listFavoriteIds(supabase, user.id),
    ]);
    viewerCountry = profile?.country_code ?? undefined;
    canPublish = publishEnabled;
    favoriteIds = favIds;
  }
  const { items, nextCursor } = await browseListings(supabase, {}, viewerCountry);
  return {
    items,
    cursor: nextCursor,
    signedIn: !!user,
    harness: false,
    canPublish,
    userId: user?.id,
    favoriteIds,
  };
}

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { items, cursor, signedIn, harness, canPublish, userId, favoriteIds } = await loadFirstPage(
    await isHarnessRequest(sp)
  );

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Marketplace</h1>
          <p className="muted" style={{ marginBottom: 12 }}>
            Buy, sell and trade with other collectors.
          </p>
        </div>
        {canPublish && (
          <Link href="/market/mine" className="btn-secondary" style={{ width: 'auto' }}>
            My listings
          </Link>
        )}
      </div>
      <MarketView
        initialListings={items}
        initialCursor={cursor}
        signedIn={signedIn}
        harness={harness}
        userId={userId}
        initialFavoriteIds={favoriteIds}
      />
    </main>
  );
}
