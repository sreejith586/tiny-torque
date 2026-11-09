import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getMeetupDetail, isRoomOpen, type MeetupDetail } from '@/domain/meetups';
import { listRoomMessages, type DealMessageRow } from '@/domain/messaging';
import MeetupRoom from '@/components/world/meetups/MeetupRoom';
import { FIXTURE_ROOM_MESSAGES, fixtureMeetupDetail } from '@/lib/visual-fixtures';
import { gateMeetups, type SearchParams } from '../../_data';

export const metadata: Metadata = {
  title: 'Live room',
};

// The live room (MV-W06-04, F-23): reachable only while the meetup is live and only for members
// (host / co-hosts / going). Anything else goes back to the detail page (not a 404 — the meetup
// exists, the room just is not open). Chat = the S6 thread table (kind meetup) through the same
// Realtime channel pattern as the deal thread.
export default async function MeetupRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const gate = await gateMeetups(sp, `/world/meetups/${id}/room`);

  let detail: MeetupDetail | null;
  let messages: DealMessageRow[];
  if (gate.harness) {
    detail = fixtureMeetupDetail(id, sp.as === 'host' ? 'host' : 'attendee', 'live');
    messages = FIXTURE_ROOM_MESSAGES;
  } else {
    detail = await getMeetupDetail(gate.supabase, id, gate.userId);
    if (!detail) notFound();
    if (!isRoomOpen(detail.meetup.status) || !detail.viewer.isMember)
      redirect(`/world/meetups/${id}`);
    messages = await listRoomMessages(gate.supabase, id).catch((): DealMessageRow[] => []);
  }
  if (!detail) notFound();

  return (
    <main style={{ padding: '20px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <h1 className="page-heading">{detail.meetup.title}</h1>
      <p className="page-sub">
        Live room · {detail.goingCount} in · hosted by{' '}
        {detail.viewer.isHost ? 'you' : `@${detail.host.handle}`}
      </p>
      <MeetupRoom detail={detail} initialMessages={messages} harness={gate.harness} />
    </main>
  );
}
