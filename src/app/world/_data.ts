// Shared gate + loader for the /world pages (MV-W02-01/02/03/05). Every page: fixture harness
// (?__visual=1, never in production) → fixtures; otherwise session → `world` flag (→ 404 while
// dark, D-028) → optional `world_shop` flag → real data through domain/world.
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Client } from '@/lib/supabase/types';
import { isFlagEnabled } from '@/domain/flags';
import { getOwnGarage, listShop, type OwnGarage, type WorldShop } from '@/domain/world';
import { listPublicCollectionItems, type GarageItem } from '@/domain/garage';
import { getProfile } from '@/domain/identity';
import { listSeasons, type SeasonRow } from '@/domain/quests';
import {
  FIXTURE_ITEMS,
  FIXTURE_PROFILE,
  FIXTURE_SEASONS,
  FIXTURE_WORLD_ITEMS,
  FIXTURE_WORLD_LEVELS,
  FIXTURE_WORLD_OWN,
  isVisualHarness,
} from '@/lib/visual-fixtures';

type SearchParams = Record<string, string | string[] | undefined>;

export interface WorldPageData {
  own: OwnGarage;
  /** The owner's public, non-deleted cars — the only ones a slot may hold. */
  items: GarageItem[];
  shop: WorldShop;
  /** Every season row (public read) — season-limited shop labels (W05). */
  seasons: SeasonRow[];
  balance: number;
  /** F-13 XP tier (profiles.level, 1-based) — the level-up gate compares against it. */
  xpLevel: number;
}

export async function loadWorldPage(
  searchParams: SearchParams,
  opts: { shop?: boolean; next: string }
): Promise<WorldPageData> {
  if (isVisualHarness(searchParams)) {
    return {
      own: FIXTURE_WORLD_OWN,
      items: FIXTURE_ITEMS.filter((i) => i.is_public),
      shop: { levels: FIXTURE_WORLD_LEVELS, items: FIXTURE_WORLD_ITEMS },
      seasons: FIXTURE_SEASONS,
      balance: FIXTURE_PROFILE.tokens,
      xpLevel: FIXTURE_PROFILE.level,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(opts.next)}`);

  const ctx = { userId: user.id };
  if (!(await isFlagEnabled(supabase, 'world', ctx))) notFound();
  if (opts.shop && !(await isFlagEnabled(supabase, 'world_shop', ctx))) notFound();

  return load(supabase, user.id);
}

async function load(supabase: Client, userId: string): Promise<WorldPageData> {
  const [own, items, shop, profile, seasons] = await Promise.all([
    getOwnGarage(supabase),
    listPublicCollectionItems(supabase, userId),
    listShop(supabase),
    getProfile(supabase, userId),
    listSeasons(supabase).catch((): SeasonRow[] => []),
  ]);
  return {
    own,
    items,
    shop,
    seasons,
    balance: profile?.tokens ?? 0,
    xpLevel: profile?.level ?? 0,
  };
}
