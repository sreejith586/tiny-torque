import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listGarage } from '@/domain/garage';
import { getProfile } from '@/domain/identity';
import { syncGamification, type Badge } from '@/domain/gamification';
import GarageView from '@/components/GarageView';
import FirstRunTour from '@/components/FirstRunTour';
import BadgeUnlockToast from '@/components/BadgeUnlockToast';
import { dismissTutorialAction } from '@/app/profile/actions';
import { FIXTURE_ITEMS, isVisualHarness } from '@/lib/visual-fixtures';

export const metadata: Metadata = {
  title: 'My Garage',
};

async function loadFirstPage(searchParams: Record<string, string | string[] | undefined>) {
  // D-041 baseline harness (non-production only): one page of fixtures, no cursor.
  if (isVisualHarness(searchParams)) {
    return { items: FIXTURE_ITEMS, cursor: null, showTour: false, unlocked: [] as Badge[] };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const [{ items, nextCursor }, profile] = await Promise.all([
    listGarage(supabase, user.id),
    getProfile(supabase, user.id),
  ]);
  // The gamification consumer runs here too (D-079) so XP/badges catch up right after an add, and
  // the unlock toast shows where the collector actually is. Never let it take the garage down.
  let unlocked: Badge[] = [];
  try {
    const summary = await syncGamification(supabase, user.id);
    unlocked = summary.newlyUnlocked
      .map((key) => summary.badges.find((b) => b.key === key))
      .filter((b): b is Badge => !!b);
  } catch {
    // RPCs missing on this environment (migration not yet applied) — stats page shows the fallback
  }
  // MV-S8-06: the first-run tour shows once, until dismissed (tutorial_dismissed_at).
  const showTour = !!profile && profile.tutorial_dismissed_at === null;
  return { items, cursor: nextCursor, showTour, unlocked };
}

export default async function GaragePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { items, cursor, showTour, unlocked } = await loadFirstPage(await searchParams);

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 className="page-heading">My Garage</h1>
        <Link href="/garage/trash" className="muted" style={{ fontSize: 13 }}>
          Trash
        </Link>
      </div>
      <p className="page-sub">Everything you own, in one place.</p>
      <GarageView initialItems={items} initialCursor={cursor} />
      {showTour && <FirstRunTour onDismiss={dismissTutorialAction} />}
      {unlocked.length > 0 && (
        <BadgeUnlockToast unlocked={unlocked.map((b) => ({ key: b.key, name: b.name }))} />
      )}
    </main>
  );
}
