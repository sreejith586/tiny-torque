import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/domain/identity';
import { listPublicProfilesByIds } from '@/domain/identity';
import { getGarageStats, type GarageStats } from '@/domain/garage';
import { listReviewsForSeller, type SellerReviewRow } from '@/domain/reviews';
import ProfileView, { type ProfileReview } from '@/components/ProfileView';
import { FIXTURE_ITEMS, FIXTURE_PROFILE, isVisualHarness } from '@/lib/visual-fixtures';
import type { ProfileRow } from '@/types/database';

export const metadata: Metadata = {
  title: 'Profile',
};

function topBrandsFromFixture(): GarageStats['topBrands'] {
  const counts = new Map<string, number>();
  for (const item of FIXTURE_ITEMS) counts.set(item.brand, (counts.get(item.brand) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([brand, count]) => ({ brand, count }));
}

async function loadProfileData(
  searchParams: Record<string, string | string[] | undefined>
): Promise<{ profile: ProfileRow; topBrands: GarageStats['topBrands']; reviews: ProfileReview[] }> {
  if (isVisualHarness(searchParams)) {
    // D-041 baseline harness, non-production only — no DB access, derive from fixture data.
    return { profile: FIXTURE_PROFILE, topBrands: topBrandsFromFixture(), reviews: [] };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await getProfile(supabase, user.id);
  if (!profile) redirect('/onboarding');

  const [stats, reviewRows] = await Promise.all([
    getGarageStats(supabase, user.id),
    listReviewsForSeller(supabase, user.id),
  ]);
  const buyerIds = [...new Set(reviewRows.map((r: SellerReviewRow) => r.buyer_id).filter(Boolean))];
  const buyers = buyerIds.length
    ? await listPublicProfilesByIds(supabase, buyerIds as string[])
    : [];
  const nameByBuyerId = new Map(buyers.map((b) => [b.id, b.display_name]));
  const reviews: ProfileReview[] = reviewRows.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    buyerName: (r.buyer_id && nameByBuyerId.get(r.buyer_id)) || 'Buyer',
  }));

  return { profile, topBrands: stats.topBrands, reviews };
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { profile, topBrands, reviews } = await loadProfileData(await searchParams);

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">Profile</h1>
      <p className="page-sub">Your account and settings.</p>
      <ProfileView profile={profile} topBrands={topBrands} reviews={reviews} />
    </main>
  );
}
