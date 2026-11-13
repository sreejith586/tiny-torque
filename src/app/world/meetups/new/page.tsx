import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getHostCapacity, type HostCapacity } from '@/domain/meetups';
import { getHostIneligibleReason, listStaffClubs, type StaffClub } from '@/domain/clubs';
import { isFlagEnabled } from '@/domain/flags';
import MeetupCreateForm from '@/components/world/meetups/MeetupCreateForm';
import { MEETUP_ERROR_COPY, defaultStartInput } from '@/components/world/meetups/copy';
import { FIXTURE_HOST_CAPACITY, FIXTURE_STAFF_CLUBS } from '@/lib/visual-fixtures';
import { gateMeetups, type SearchParams } from '../_data';

export const metadata: Metadata = {
  title: 'Host a meetup',
};

// Single-page create form (MV-W06-03; the prototype has no wizards, D-027). Virtual fields only —
// the in-person section is W10 (F-24, `world_meetups_irl`). W07: "Host as" lists the clubs the caller
// runs (only while `world_clubs` is on for them), and the hosting rule (F-28) replaces the form with
// its reason when the caller may not host.
export default async function NewMeetupPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const gate = await gateMeetups(sp, '/world/meetups/new');
  let cap: HostCapacity;
  let clubs: StaffClub[] = [];
  let reason: Awaited<ReturnType<typeof getHostIneligibleReason>> = null;
  if (gate.harness) {
    cap = FIXTURE_HOST_CAPACITY;
    clubs = FIXTURE_STAFF_CLUBS;
  } else {
    cap = await getHostCapacity(gate.supabase, gate.userId).catch(() => null!);
    if (!cap) notFound();
    const clubsOn = await isFlagEnabled(gate.supabase, 'world_clubs', { userId: gate.userId });
    [clubs, reason] = await Promise.all([
      clubsOn ? listStaffClubs(gate.supabase, gate.userId).catch((): StaffClub[] => []) : [],
      cap.cap > 0 ? getHostIneligibleReason(gate.supabase).catch(() => null) : null,
    ]);
  }

  const defaultStartsAt = defaultStartInput();

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">Host a meetup</h1>
      <p className="page-sub">
        A virtual show-and-tell at your garage. Save it as a draft, then schedule it when you are
        ready.
      </p>
      {reason ? (
        <div className="panel">
          <p className="muted" style={{ fontSize: 13 }}>
            {MEETUP_ERROR_COPY[reason]}
          </p>
        </div>
      ) : (
        <MeetupCreateForm
          cap={cap.cap}
          levelName={cap.levelName}
          level={cap.level}
          isPro={cap.isPro}
          defaultStartsAt={defaultStartsAt}
          clubs={clubs.map((c) => ({ id: c.id, name: c.name }))}
          defaultClubId={typeof sp.club === 'string' ? sp.club : null}
          harness={gate.harness}
        />
      )}
    </main>
  );
}
