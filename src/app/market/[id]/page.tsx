import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getListing, listingPriceLabel, listFavoriteIds } from '@/domain/marketplace';
import { getPublicProfileById } from '@/domain/identity';
import ListingDetailView from '@/components/ListingDetailView';
import { FIXTURE_LISTINGS, FIXTURE_PUBLIC_PROFILE } from '@/lib/visual-fixtures';
import { isHarnessRequest } from '@/lib/visual-harness.server';

// Anon public route; per-request render (isHarnessRequest touches headers()/cookies()).
export const dynamic = 'force-dynamic';

async function load(id: string, harness: boolean) {
  if (harness) {
    const listing = FIXTURE_LISTINGS.find((l) => l.id === id) ?? FIXTURE_LISTINGS[0];
    return { listing, seller: FIXTURE_PUBLIC_PROFILE, userId: undefined, favorited: false };
  }
  const supabase = await createClient();
  const listing = await getListing(supabase, id);
  if (!listing) return { listing: null, seller: null, userId: undefined, favorited: false };
  const seller = await getPublicProfileById(supabase, listing.seller_id);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let favorited = false;
  if (user) {
    const favoriteIds = await listFavoriteIds(supabase, user.id);
    favorited = favoriteIds.includes(listing.id);
  }
  return { listing, seller, userId: user?.id, favorited };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const listing = await getListing(supabase, id).catch(() => null);
  if (!listing) return { title: 'Listing' };
  const title = [listing.brand, listing.model].filter(Boolean).join(' ');
  const description = `${listingPriceLabel(listing)} — ${title} on Tiny Torque`;
  return { title, description, openGraph: { title, description } };
}

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const harness = await isHarnessRequest(await searchParams);
  const { listing, seller, userId, favorited } = await load(id, harness);
  if (!listing) notFound();

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <ListingDetailView
        listing={listing}
        seller={seller}
        harness={harness}
        userId={userId}
        initialFavorited={favorited}
      />
    </main>
  );
}
