import type { Metadata } from 'next';
import Link from 'next/link';
import { getHostCapacity, listMeetups, type MeetupListItem } from '@/domain/meetups';
import {
  STATUS_LABEL,
  STATUS_PILL_CLASS,
  VISIBILITY_SHORT,
  formatWhen,
} from '@/components/world/meetups/copy';
import { FIXTURE_HOST_CAPACITY, FIXTURE_MEETUPS } from '@/lib/visual-fixtures';
import { gateMeetups, harnessHref, type SearchParams } from './_data';

export const metadata: Metadata = {
  title: 'Meetups',
};

// /world/meetups (MV-W06-03, F-23): upcoming (everything the viewer may see, soonest first) and
// mine (hosted ∪ joined). Composed from prototype pieces only (D-027 / D-086): tab-row + tab-chip,
// panel rows, status-pill, btn-primary, empty-state.
export default async function MeetupsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const tab: 'upcoming' | 'mine' = sp.tab === 'mine' ? 'mine' : 'upcoming';
  const gate = await gateMeetups(sp, `/world/meetups${tab === 'mine' ? '?tab=mine' : ''}`);

  let rows: MeetupListItem[];
  let canHost: boolean;
  if (gate.harness) {
    rows = tab === 'mine' ? FIXTURE_MEETUPS.filter((m) => m.isHost || m.myRsvp) : FIXTURE_MEETUPS;
    canHost = FIXTURE_HOST_CAPACITY.cap > 0;
  } else {
    const [list, cap] = await Promise.all([
      listMeetups(gate.supabase, gate.userId, tab).catch((): MeetupListItem[] => []),
      getHostCapacity(gate.supabase, gate.userId).catch(() => null),
    ]);
    rows = list;
    canHost = (cap?.cap ?? 0) > 0;
  }

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">Meetups</h1>
      <p className="page-sub">
        Show-and-tell nights hosted at collectors’ garages, with a live room.
      </p>

      <div className="tab-row">
        <Link
          href={harnessHref(sp, '/world/meetups')}
          className={`tab-chip ${tab === 'upcoming' ? 'active' : ''}`}
          aria-current={tab === 'upcoming' ? 'page' : undefined}
        >
          Upcoming
        </Link>
        <Link
          href={harnessHref(sp, '/world/meetups?tab=mine')}
          className={`tab-chip ${tab === 'mine' ? 'active' : ''}`}
          aria-current={tab === 'mine' ? 'page' : undefined}
        >
          Mine
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">
          <p>
            {tab === 'mine'
              ? 'You have not hosted or joined a meetup yet.'
              : 'No meetups coming up. Host the first one.'}
          </p>
        </div>
      ) : (
        <div className="panel">
          {rows.map(({ meetup, host, goingCount, myRsvp, isHost }) => (
            <Link
              key={meetup.id}
              href={harnessHref(sp, `/world/meetups/${meetup.id}`)}
              className="toggle-row"
              style={{ textDecoration: 'none', alignItems: 'flex-start' }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600 }}>{meetup.title}</span>
                <span className="muted" style={{ display: 'block', fontSize: 12 }}>
                  {formatWhen(meetup.starts_at, meetup.ends_at)}
                </span>
                <span className="muted" style={{ display: 'block', fontSize: 12 }}>
                  {isHost ? 'You host' : `Host @${host.handle}`} ·{' '}
                  {VISIBILITY_SHORT[meetup.visibility]}
                  {meetup.theme ? ` · ${meetup.theme}` : ''}
                </span>
              </span>
              <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <span className={`status-pill ${STATUS_PILL_CLASS[meetup.status]}`}>
                  {STATUS_LABEL[meetup.status]}
                </span>
                <span className="muted" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>
                  {goingCount}/{meetup.capacity} going
                  {myRsvp === 'going'
                    ? ' · you’re in'
                    : myRsvp === 'waitlist'
                      ? ' · waitlisted'
                      : ''}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        {canHost ? (
          <Link
            href={harnessHref(sp, '/world/meetups/new')}
            className="btn-primary"
            style={{ display: 'block', textAlign: 'center' }}
          >
            Host a meetup
          </Link>
        ) : (
          <p className="muted" style={{ fontSize: 13 }}>
            Hosting opens at garage level 2 —{' '}
            <Link href={harnessHref(sp, '/world/shop')}>level up in the World shop</Link>. Joining
            is free.
          </p>
        )}
      </div>
    </main>
  );
}
