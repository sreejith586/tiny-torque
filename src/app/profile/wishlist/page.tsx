import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listWishlist } from '@/domain/marketplace';
import { listEnabledCountries } from '@/domain/identity';
import WishlistView from '@/components/WishlistView';

export const metadata: Metadata = {
  title: 'Wishlist',
};

export const dynamic = 'force-dynamic';

export default async function WishlistPage() {
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
