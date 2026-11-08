import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getHostCapacity, type HostCapacity } from '@/domain/meetups';
import MeetupCreateForm from '@/components/world/meetups/MeetupCreateForm';
import { defaultStartInput } from '@/components/world/meetups/copy';
import { FIXTURE_HOST_CAPACITY } from '@/lib/visual-fixtures';
import { gateMeetups, type SearchParams } from '../_data';

export const metadata: Metadata = {
  title: 'Host a meetup',
};

// Single-page create form (MV-W06-03; the prototype has no wizards, D-027). Virtual fields only —
// the in-person section is W10 (F-24, `world_meetups_irl`).
export default async function NewMeetupPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const gate = await gateMeetups(sp, '/world/meetups/new');
  let cap: HostCapacity;
  if (gate.harness) {
    cap = FIXTURE_HOST_CAPACITY;
  } else {
    cap = await getHostCapacity(gate.supabase, gate.userId).catch(() => null!);
    if (!cap) notFound();
  }

  const defaultStartsAt = defaultStartInput();

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">Host a meetup</h1>
      <p className="page-sub">
        A virtual show-and-tell at your garage. Save it as a draft, then schedule it when you are
        ready.
      </p>
      <MeetupCreateForm
        cap={cap.cap}
        levelName={cap.levelName}
        level={cap.level}
        isPro={cap.isPro}
        defaultStartsAt={defaultStartsAt}
        harness={gate.harness}
      />
    </main>
  );
}
