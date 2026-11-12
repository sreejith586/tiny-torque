import type { Metadata } from 'next';
import Link from 'next/link';
import { getHostIneligibleReason, listClubs, type ClubListItem } from '@/domain/clubs';
import { CLUB_ERROR_COPY, JOIN_MODE_SHORT, ROLE_LABEL } from '@/components/world/clubs/copy';
import { FIXTURE_CLUBS } from '@/lib/visual-fixtures';
import { gateClubs, harnessHref, type SearchParams } from './_data';

export const metadata: Metadata = {
  title: 'Clubs',
};

// /world/clubs (MV-W07-03, F-22): every club, or the ones the viewer belongs to / asked to join /
// was invited to. Composed from prototype pieces only (D-027 / D-086): tab-row + tab-chip, panel
// rows (toggle-row), level-pill, btn-primary, empty-state — the same layout as /world/meetups.
export default async function ClubsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const tab: 'all' | 'mine' = sp.tab === 'mine' ? 'mine' : 'all';
  const gate = await gateClubs(sp, `/world/clubs${tab === 'mine' ? '?tab=mine' : ''}`);

  let rows: ClubListItem[];
  let blocked: string | null = null;
  if (gate.harness) {
    rows = tab === 'mine' ? FIXTURE_CLUBS.filter((c) => c.myStatus) : FIXTURE_CLUBS;
  } else {
    const [list, reason] = await Promise.all([
      listClubs(gate.supabase, gate.userId, tab).catch((): ClubListItem[] => []),
      getHostIneligibleReason(gate.supabase).catch(() => null),
    ]);
    rows = list;
    blocked = reason ? CLUB_ERROR_COPY[reason] : null;
  }

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">Clubs</h1>
      <p className="page-sub">Collectors with a shared clubhouse, a feed and club meetups.</p>

      <div className="tab-row">
        <Link
          href={harnessHref(sp, '/world/clubs')}
          className={`tab-chip ${tab === 'all' ? 'active' : ''}`}
          aria-current={tab === 'all' ? 'page' : undefined}
        >
          All clubs
        </Link>
        <Link
          href={harnessHref(sp, '/world/clubs?tab=mine')}
          className={`tab-chip ${tab === 'mine' ? 'active' : ''}`}
          aria-current={tab === 'mine' ? 'page' : undefined}
        >
          Mine
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">
          <p>
            {tab === 'mine' ? 'You are not in a club yet.' : 'No clubs yet. Start the first one.'}
          </p>
        </div>
      ) : (
        <div className="panel">
          {rows.map(({ club, memberCount, myStatus, myRole, invited }) => (
            <Link
              key={club.id}
              href={harnessHref(sp, `/world/clubs/${club.slug}`)}
              className="toggle-row"
              style={{ textDecoration: 'none', alignItems: 'flex-start' }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600 }}>{club.name}</span>
                <span className="muted" style={{ display: 'block', fontSize: 12 }}>
                  @{club.slug} · {JOIN_MODE_SHORT[club.join_mode]}
                  {club.country_code ? ` · ${club.country_code}` : ''}
                </span>
              </span>
              <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                {myRole ? (
                  <span className="level-pill">{ROLE_LABEL[myRole]}</span>
                ) : myStatus === 'pending' ? (
                  <span className="level-pill">{invited ? 'Invited' : 'Requested'}</span>
                ) : null}
                <span className="muted" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>
                  {memberCount} member{memberCount === 1 ? '' : 's'}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        {blocked ? (
          <p className="muted" style={{ fontSize: 13 }}>
            {blocked} Joining a club is open to everyone.
          </p>
        ) : (
          <Link
            href={harnessHref(sp, '/world/clubs/new')}
            className="btn-primary"
            style={{ display: 'block', textAlign: 'center' }}
          >
            Start a club
          </Link>
        )}
      </div>
    </main>
  );
}
