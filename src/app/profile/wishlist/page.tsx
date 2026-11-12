import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listWishlist } from '@/domain/marketplace';
import { listEnabledCountries } from '@/domain/identity';
import WishlistView from '@/components/WishlistView';
import { FIXTURE_COUNTRIES, FIXTURE_PROFILE, FIXTURE_WISHLIST } from '@/lib/visual-fixtures';
import { isHarnessRequest } from '@/lib/visual-harness.server';

export const metadata: Metadata = {
  title: 'Wishlist',
};

export const dynamic = 'force-dynamic';

export default async function WishlistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // D-056 fixture harness (non-production only, MV-S9-05).
  if (await isHarnessRequest(await searchParams)) {
    return (
      <main style={{ padding: '20px 16px', flex: 1 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Wishlist</h1>
        <p className="muted" style={{ marginBottom: 12 }}>
          Cars you&apos;re hunting for — not necessarily for sale anywhere yet.
        </p>
        <WishlistView
          initialItems={FIXTURE_WISHLIST}
          userId={FIXTURE_PROFILE.id}
          currencyOptions={FIXTURE_COUNTRIES.map((c) => c.currency)}
        />
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [items, countries] = await Promise.all([
    listWishlist(supabase, user.id),
    listEnabledCountries(supabase),
  ]);
  const currencyOptions = Array.from(new Set(countries.map((c) => c.currency)));

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Wishlist</h1>
      <p className="muted" style={{ marginBottom: 12 }}>
        Cars you&apos;re hunting for — not necessarily for sale anywhere yet.
      </p>
      <WishlistView initialItems={items} userId={user.id} currencyOptions={currencyOptions} />
    </main>
  );
}
