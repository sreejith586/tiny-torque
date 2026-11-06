import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import SeasonTrack from '@/components/world/SeasonTrack';
import { createClient } from '@/lib/supabase/server';
import { isFlagEnabled } from '@/domain/flags';
import { getSeasonTrack, type SeasonTrackView } from '@/domain/quests';
import { listShop } from '@/domain/world';
import { FIXTURE_SEASON_TRACK, FIXTURE_WORLD_ITEMS, isVisualHarness } from '@/lib/visual-fixtures';

export const metadata: Metadata = {
  title: 'Season',
};

// Season v0 page (MV-W05-03, D-093 proposed). Fixture harness (?__visual=1, never in production)
// → fixtures; otherwise session → `world` + `world_earn` flags (→ 404 while dark, D-028) → the
// caller's track through domain/quests.
export default async function WorldSeasonPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  let view: SeasonTrackView | null;
  let trophyName: string | null = null;

  if (isVisualHarness(sp)) {
    view = FIXTURE_SEASON_TRACK;
    trophyName = FIXTURE_WORLD_ITEMS.find((i) => i.sku === view?.finisherItemSku)?.name ?? null;
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login?next=%2Fworld%2Fseason');
    const ctx = { userId: user.id };
    if (!(await isFlagEnabled(supabase, 'world', ctx))) notFound();
    if (!(await isFlagEnabled(supabase, 'world_earn', ctx))) notFound();
    view = await getSeasonTrack(supabase, user.id);
    if (view?.finisherItemSku) {
      const shop = await listShop(supabase).catch(() => null);
      trophyName = shop?.items.find((i) => i.sku === view?.finisherItemSku)?.name ?? null;
    }
  }

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">Season</h1>
      <p className="page-sub">
        A free track: finish quests, climb the milestones, keep the trophy.
      </p>
      {view ? (
        <SeasonTrack view={view} trophyName={trophyName} />
      ) : (
        <div className="empty-state">
          <p>No season is running right now. The next one is announced in Collectors World.</p>
        </div>
      )}
    </main>
  );
}
