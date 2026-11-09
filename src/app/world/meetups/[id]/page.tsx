import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMeetupDetail, type MeetupDetail } from '@/domain/meetups';
import { listPublicCollectionItems, type GarageItem } from '@/domain/garage';
import MeetupDetailView from '@/components/world/meetups/MeetupDetailView';
import { formatWhen } from '@/components/world/meetups/copy';
import { FIXTURE_ITEMS, fixtureMeetupDetail } from '@/lib/visual-fixtures';
import { gateMeetups, type SearchParams } from '../_data';

export const metadata: Metadata = {
  title: 'Meetup',
};

// Meetup detail (MV-W06-03, F-23): title / when / host / status, RSVP (going ↔ not going, waitlist
// when full), the attendee list, the showcase grid (CarCard) with the viewer's ≤ 3-car picker, and
// the host panel (schedule with the fee, cancel with the refund rule, open / end the room, invite by
// handle, co-hosts, mute / kick). 404 for anything the viewer may not see, and while dark.
export default async function MeetupDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const gate = await gateMeetups(sp, `/world/meetups/${id}`);

  let detail: MeetupDetail | null;
  let myItems: GarageItem[];
  if (gate.harness) {
    detail = fixtureMeetupDetail(id, sp.as === 'host' ? 'host' : 'attendee');
    myItems = FIXTURE_ITEMS.filter((i) => i.is_public);
  } else {
    detail = await getMeetupDetail(gate.supabase, id, gate.userId);
    myItems = detail
      ? await listPublicCollectionItems(gate.supabase, gate.userId).catch((): GarageItem[] => [])
      : [];
  }
  if (!detail) notFound();

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">{detail.meetup.title}</h1>
      <p className="page-sub">
        {formatWhen(detail.meetup.starts_at, detail.meetup.ends_at)} · hosted by{' '}
        {detail.viewer.isHost ? 'you' : `@${detail.host.handle}`}
      </p>
      <MeetupDetailView
        detail={detail}
        myItems={myItems}
        harness={gate.harness}
        harnessQuery={gate.harness ? `?__visual=1${sp.as === 'host' ? '&as=host' : ''}` : ''}
      />
    </main>
  );
}
