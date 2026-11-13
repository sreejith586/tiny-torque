import type { Metadata } from 'next';
import { getHostIneligibleReason } from '@/domain/clubs';
import ClubCreateForm from '@/components/world/clubs/ClubCreateForm';
import { CLUB_ERROR_COPY } from '@/components/world/clubs/copy';
import { gateClubs, type SearchParams } from '../_data';

export const metadata: Metadata = {
  title: 'Start a club',
};

// Single-page create form (MV-W07-03; the prototype has no wizards, D-027). Owner eligibility is
// the hosting rule (F-28): the reason is shown instead of the form when the caller cannot start one.
export default async function NewClubPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const gate = await gateClubs(sp, '/world/clubs/new');
  const reason = gate.harness
    ? null
    : await getHostIneligibleReason(gate.supabase).catch(() => null);

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">Start a club</h1>
      <p className="page-sub">
        A clubhouse for collectors who share a taste. You become its owner and can add admins.
      </p>
      {reason ? (
        <div className="panel">
          <p className="muted" style={{ fontSize: 13 }}>
            {CLUB_ERROR_COPY[reason]}
          </p>
        </div>
      ) : (
        <ClubCreateForm harness={gate.harness} />
      )}
    </main>
  );
}
