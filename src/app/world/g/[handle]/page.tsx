import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isFlagEnabled } from '@/domain/flags';
import {
  getGarageForVisitor,
  listGuestbook,
  recordVisit,
  type GuestbookEntry,
  type VisitorGarage,
} from '@/domain/world';
import { listPublicCollectionItems, type GarageItem } from '@/domain/garage';
import { listMyListings, type Listing } from '@/domain/marketplace';
import { countFollowers, getPublicProfileById, isFollowing } from '@/domain/identity';
import VisitorGarageView from '@/components/world/VisitorGarageView';
import {
  FIXTURE_ITEMS,
  FIXTURE_LISTINGS,
  FIXTURE_WORLD_GUESTBOOK,
  FIXTURE_WORLD_VISITOR,
  isVisualHarness,
} from '@/lib/visual-fixtures';

type SearchParams = Record<string, string | string[] | undefined>;

interface VisitorPageData {
  garage: VisitorGarage;
  items: GarageItem[];
  listingByItem: Record<string, string>;
  guestbook: GuestbookEntry[];
  viewerId: string | null;
  viewerHandle: string | null;
  viewerFollows: boolean;
  followerCount: number;
}

// /world/g/{handle} (MV-W03-03, D-087 proposed). Public route (share links, 07 §2.2): anon sees
// public garages read-only; 404 for unknown / hidden garages and while `world` is off (dark).
// Opening the page is the visit (one row per visitor per day, never for the owner).
async function load(handle: string, searchParams: SearchParams): Promise<VisitorPageData | null> {
  if (isVisualHarness(searchParams)) {
    const items = FIXTURE_ITEMS.filter((i) => i.is_public);
    const listed = FIXTURE_LISTINGS[0];
    return {
      garage: FIXTURE_WORLD_VISITOR,
      items,
      listingByItem: listed?.source_item_id ? { [listed.source_item_id]: listed.id } : {},
      guestbook: FIXTURE_WORLD_GUESTBOOK,
      viewerId: '00000000-0000-4000-8000-000000000002',
      viewerHandle: 'visitor',
      viewerFollows: false,
      followerCount: 12,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!(await isFlagEnabled(supabase, 'world', { userId: user?.id }))) return null;

  const garage = await getGarageForVisitor(supabase, handle, user?.id ?? null);
  if (!garage) return null;
  const ownerId = garage.owner.id;
  const viewerId = user?.id ?? null;
  const isOwner = viewerId === ownerId;

  const [items, listings, guestbook, followerCount, viewerFollows, viewer] = await Promise.all([
    listPublicCollectionItems(supabase, ownerId),
    listMyListings(supabase, ownerId, 'active').catch((): Listing[] => []),
    listGuestbook(supabase, ownerId),
    countFollowers(supabase, ownerId).catch(() => 0),
    viewerId && !isOwner ? isFollowing(supabase, viewerId, ownerId).catch(() => false) : false,
    viewerId ? getPublicProfileById(supabase, viewerId).catch(() => null) : null,
  ]);
  if (viewerId && !isOwner) {
    // Best-effort: a rate-limited or raced visit must never take the page down.
    await recordVisit(supabase, ownerId).catch(() => null);
  }
  const listingByItem: Record<string, string> = {};
  for (const l of listings) if (l.source_item_id) listingByItem[l.source_item_id] = l.id;

  return {
    garage,
    items,
    listingByItem,
    guestbook,
    viewerId,
    viewerHandle: viewer?.handle ?? null,
    viewerFollows,
    followerCount,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  return { title: `@${handle}'s garage` };
}

export default async function VisitorGaragePage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { handle } = await params;
  const data = await load(handle, await searchParams);
  if (!data) notFound();

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">{data.garage.garage.name}</h1>
      <p className="page-sub">
        {data.garage.owner.displayName}&apos;s garage · Level {data.garage.level.level} ·{' '}
        {data.garage.level.name}
      </p>
      <VisitorGarageView {...data} />
    </main>
  );
}
