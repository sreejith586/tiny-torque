import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCollectionItem } from '@/domain/garage';
import { isFlagEnabled } from '@/domain/flags';
import { findActiveListingForItem, type Listing } from '@/domain/marketplace';
import { listEnabledCountries } from '@/domain/identity';
import CarDetailView from '@/components/CarDetailView';
import { FIXTURE_ITEMS, FIXTURE_COUNTRIES, isVisualHarness } from '@/lib/visual-fixtures';

async function loadItem(id: string, searchParams: Record<string, string | string[] | undefined>) {
  if (isVisualHarness(searchParams)) {
    // D-041 baseline harness, non-production only
    const item = FIXTURE_ITEMS.find((i) => i.id === id);
    if (!item) notFound();
    return {
      item,
      isOwner: true,
      publishEnabled: true,
      existingListing: null as Listing | null,
      defaultCurrency: 'INR',
      currencyOptions: FIXTURE_COUNTRIES.map((c) => c.currency),
    };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const item = await getCollectionItem(supabase, id);
  if (!item) notFound();
  const isOwner = item.owner_id === user.id;

  if (!isOwner) {
    return {
      item,
      isOwner,
      publishEnabled: false,
      existingListing: null as Listing | null,
      defaultCurrency: 'AED',
      currencyOptions: [] as string[],
    };
  }

  const [publishEnabled, existingListing, { data: profile }, countries] = await Promise.all([
    isFlagEnabled(supabase, 'marketplace_publish', { userId: user.id }),
    findActiveListingForItem(supabase, user.id, item.id),
    supabase.from('profiles').select('country_code').eq('id', user.id).maybeSingle(),
    listEnabledCountries(supabase),
  ]);
  const defaultCurrency =
    countries.find((c) => c.code === profile?.country_code)?.currency ?? 'AED';
  const currencyOptions = Array.from(new Set(countries.map((c) => c.currency)));

  return { item, isOwner, publishEnabled, existingListing, defaultCurrency, currencyOptions };
}

export default async function CarDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { item, isOwner, publishEnabled, existingListing, defaultCurrency, currencyOptions } =
    await loadItem(id, await searchParams);

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <CarDetailView
        item={item}
        isOwner={isOwner}
        publishEnabled={publishEnabled}
        existingListing={existingListing}
        defaultCurrency={defaultCurrency}
        currencyOptions={currencyOptions}
      />
    </main>
  );
}
