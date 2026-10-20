import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPublicProfile, listPublicProfilesByIds } from '@/domain/identity';
import { listPublicCollectionItems } from '@/domain/garage';
import { listMyListings, type Listing } from '@/domain/marketplace';
import { listReviewsForSeller } from '@/domain/reviews';
import { levelForXp } from '@/domain/gamification';
import PublicProfileView from '@/components/PublicProfileView';
import type { ProfileReview } from '@/components/ProfileView';
import {
  FIXTURE_PUBLIC_PROFILE,
  FIXTURE_ITEMS,
  FIXTURE_LISTINGS,
  isVisualHarness,
} from '@/lib/visual-fixtures';

async function loadProfile(
  handle: string,
  searchParams: Record<string, string | string[] | undefined>
) {
  if (isVisualHarness(searchParams)) {
    return {
      profile: FIXTURE_PUBLIC_PROFILE,
      items: FIXTURE_ITEMS.filter((i) => i.is_public),
      listings: FIXTURE_LISTINGS.slice(0, 2),
      reviews: [] as ProfileReview[],
    };
  }
  const supabase = await createClient();
  const profile = await getPublicProfile(supabase, handle);
  if (!profile) return null;
  const sellerId = profile.id!;
  // Only public rows reach anon here: public items (RLS), active listings (the public SELECT
  // policy), and reviews (publicly readable). Nothing from the base `profiles` table (rule 15).
  const [items, listings, reviewRows] = await Promise.all([
    listPublicCollectionItems(supabase, sellerId),
    listMyListings(supabase, sellerId, 'active').catch((): Listing[] => []),
    listReviewsForSeller(supabase, sellerId),
  ]);
  const buyerIds = [...new Set(reviewRows.map((r) => r.buyer_id).filter(Boolean))] as string[];
  const buyers = buyerIds.length ? await listPublicProfilesByIds(supabase, buyerIds) : [];
  const nameByBuyerId = new Map(buyers.map((b) => [b.id, b.display_name]));
  const reviews: ProfileReview[] = reviewRows.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    buyerName: (r.buyer_id && nameByBuyerId.get(r.buyer_id)) || 'Buyer',
  }));
  return { profile, items, listings, reviews };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { handle } = await params;
  let profile;
  try {
    profile = isVisualHarness(await searchParams)
      ? FIXTURE_PUBLIC_PROFILE
      : await getPublicProfile(await createClient(), handle);
  } catch {
    // A metadata-generation error takes down the whole route in Next.js, not just the <title> —
    // fail soft here and let the page component's own error handling be the real signal.
    return { title: 'Collector not found' };
  }
  if (!profile) return { title: 'Collector not found' };

  const title = `${profile.display_name} (@${profile.handle})`;
  const tier = levelForXp(profile.xp ?? 0).tier;
  const description = profile.bio
    ? profile.bio
    : `${profile.display_name}'s diecast collection on Tiny Torque · ${tier}.`;
  // openGraph isn't covered by the root layout's title template, so it gets the full name here.
  // The OG image comes from the sibling opengraph-image.tsx file convention (F-14 share sheet).
  return { title, description, openGraph: { title: `${title} · Tiny Torque`, description } };
}

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { handle } = await params;
  const sp = await searchParams;
  const result = await loadProfile(handle, sp);
  if (!result) notFound();

  let viewerId: string | undefined;
  if (!isVisualHarness(sp)) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    viewerId = user?.id;
  }

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'tinytorque.hypermaxsolutions.com';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const shareUrl = `${proto}://${host}/u/${result.profile.handle}`;

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <PublicProfileView
        profile={result.profile}
        items={result.items}
        listings={result.listings}
        reviews={result.reviews}
        tier={levelForXp(result.profile.xp ?? 0).tier}
        viewerId={viewerId}
        shareUrl={shareUrl}
      />
    </main>
  );
}
