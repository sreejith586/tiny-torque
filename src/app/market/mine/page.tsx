import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isFlagEnabled } from '@/domain/flags';
import { listMyListings } from '@/domain/marketplace';
import { listEnabledCountries } from '@/domain/identity';
import MyListingsView from '@/components/MyListingsView';

export const metadata: Metadata = {
  title: 'My listings',
};

export const dynamic = 'force-dynamic';

export default async function MyListingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const publishEnabled = await isFlagEnabled(supabase, 'marketplace_publish', { userId: user.id });
  if (!publishEnabled) {
    return (
      <main style={{ padding: '20px 16px', flex: 1 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>My listings</h1>
        <div className="panel" style={{ marginTop: 12 }}>
          <p className="muted">The marketplace isn&apos;t switched on for your account yet.</p>
        </div>
      </main>
    );
  }

  const [listings, countries] = await Promise.all([
    listMyListings(supabase, user.id),
    listEnabledCountries(supabase),
  ]);
  const currencyOptions = Array.from(new Set(countries.map((c) => c.currency)));

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>My listings</h1>
      <p className="muted" style={{ marginBottom: 12 }}>
        Manage what you&apos;ve published to the marketplace.
      </p>
      <MyListingsView
        initialListings={listings}
        currencyOptions={currencyOptions}
        userId={user.id}
      />
    </main>
  );
}
