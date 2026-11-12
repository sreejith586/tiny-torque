import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getClubDetail, type ClubDetail } from '@/domain/clubs';
import { getHostCapacity } from '@/domain/meetups';
import ClubhouseView from '@/components/world/clubs/ClubhouseView';
import { JOIN_MODE_SHORT } from '@/components/world/clubs/copy';
import { defaultStartInput } from '@/components/world/meetups/copy';
import { fixtureClubDetail } from '@/lib/visual-fixtures';
import { gateClubs, type SearchParams } from '../_data';

export const metadata: Metadata = {
  title: 'Club',
};

// The clubhouse (MV-W07-03/04, F-22): members' featured cars, the club feed, upcoming club meetups,
// the recurring club night, the roster with roles, and the owner / admin tools (requests, invites,
// bans, settings). What the viewer may not read (a closed club's roster and feed) is simply empty —
// RLS and club_feed() decide, not this page. 404 for an unknown club, and while dark.
export default async function ClubPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const gate = await gateClubs(sp, `/world/clubs/${slug}`);
  const seat = sp.as === 'owner' ? 'owner' : sp.as === 'visitor' ? 'visitor' : 'member';

  let detail: ClubDetail | null;
  let hostCap = 0;
  if (gate.harness) {
    detail = fixtureClubDetail(slug, seat);
    hostCap = 10;
  } else {
    detail = await getClubDetail(gate.supabase, slug, gate.userId);
    if (detail?.viewer.isStaff && gate.meetupsOn) {
      hostCap = await getHostCapacity(gate.supabase, gate.userId)
        .then((c) => c.cap)
        .catch(() => 0);
    }
  }
  if (!detail) notFound();

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">{detail.club.name}</h1>
      <p className="page-sub">
        @{detail.club.slug} · {JOIN_MODE_SHORT[detail.club.join_mode]} · {detail.memberCount} member
        {detail.memberCount === 1 ? '' : 's'}
        {detail.club.country_code ? ` · ${detail.club.country_code}` : ''}
      </p>
      <ClubhouseView
        detail={detail}
        meetupsOn={gate.meetupsOn}
        hostCap={hostCap}
        defaultNightStart={defaultStartInput()}
        harness={gate.harness}
        harnessQuery={gate.harness ? `?__visual=1&as=${seat}` : ''}
      />
    </main>
  );
}
