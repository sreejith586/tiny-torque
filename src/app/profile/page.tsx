import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfile, listPublicProfilesByIds } from '@/domain/identity';
import { getGarageStats, computeStats, type GarageStats } from '@/domain/garage';
import { listReviewsForSeller, type SellerReviewRow } from '@/domain/reviews';
import {
  syncGamification,
  levelProgress,
  questStatus,
  utcDay,
  type Badge,
  type GamificationSummary,
} from '@/domain/gamification';
import ProfileView, { type ProfileReview } from '@/components/ProfileView';
import ProfileStats from '@/components/ProfileStats';
import BadgeUnlockToast from '@/components/BadgeUnlockToast';
import {
  FIXTURE_BADGES,
  FIXTURE_ITEMS,
  FIXTURE_PROFILE,
  isVisualHarness,
} from '@/lib/visual-fixtures';
import type { ProfileRow } from '@/types/database';

export const metadata: Metadata = {
  title: 'Profile',
};

interface ProfileData {
  profile: ProfileRow;
  stats: GarageStats;
  summary: GamificationSummary;
  reviews: ProfileReview[];
}

async function loadProfileData(
  searchParams: Record<string, string | string[] | undefined>
): Promise<ProfileData> {
  if (isVisualHarness(searchParams)) {
    // D-056 fixture harness, non-production only — no DB access.
    return {
      profile: FIXTURE_PROFILE,
      stats: computeStats(FIXTURE_ITEMS),
      summary: {
        level: levelProgress(FIXTURE_PROFILE.xp),
        badges: FIXTURE_BADGES,
        quest: questStatus(FIXTURE_PROFILE.id, [], utcDay(new Date().toISOString())),
        newlyUnlocked: [],
        xpDelta: 0,
      },
      reviews: [],
    };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await getProfile(supabase, user.id);
  if (!profile) redirect('/onboarding');

  // The gamification consumer runs on profile view (D-079). Never let it take the page down: if
  // the RPCs are missing (migration not yet applied on this environment) fall back to the stored
  // xp and an empty badge list.
  let summary: GamificationSummary;
  try {
    summary = await syncGamification(supabase, user.id);
  } catch {
    summary = {
      level: levelProgress(profile.xp),
      badges: [],
      quest: questStatus(user.id, [], utcDay(new Date().toISOString())),
      newlyUnlocked: [],
      xpDelta: 0,
    };
  }

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

  return { profile, stats, summary, reviews };
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { profile, stats, summary, reviews } = await loadProfileData(await searchParams);
  const unlocked = summary.newlyUnlocked
    .map((key) => summary.badges.find((b: Badge) => b.key === key))
    .filter((b): b is Badge => !!b)
    .map((b) => ({ key: b.key, name: b.name }));

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">Profile</h1>
      <p className="page-sub">Your collection at a glance, your level and your badges.</p>
      <ProfileView profile={profile} tier={summary.level.tier} reviews={reviews} />
      {summary.badges.length > 0 ? (
        <ProfileStats
          stats={stats}
          level={summary.level}
          badges={summary.badges}
          quest={summary.quest}
        />
      ) : (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Stats and badges are warming up — check back in a moment.
        </p>
      )}
      {unlocked.length > 0 && <BadgeUnlockToast unlocked={unlocked} />}
    </main>
  );
}
