import { createClient } from '@/lib/supabase/server';
import { listOpenReports } from '@/domain/trust';
import { getListingsByIds } from '@/domain/marketplace';
import { listPublicProfilesByIds } from '@/domain/identity';
import { listGuestbookByIds } from '@/domain/world';
import AdminReportsQueueView from '@/components/AdminReportsQueueView';

export default async function AdminReportsPage() {
  const supabase = await createClient();
  const reports = await listOpenReports(supabase);

  const listingIds = reports
    .filter((r) => r.target_type === 'listing' && r.target_id)
    .map((r) => r.target_id!);
  // `user` and `garage` reports both point at a person (a garage is 1:1 with its owner, W03)
  const userIds = reports
    .filter((r) => (r.target_type === 'user' || r.target_type === 'garage') && r.target_id)
    .map((r) => r.target_id!);
  const guestbookIds = reports
    .filter((r) => r.target_type === 'guestbook' && r.target_id)
    .map((r) => r.target_id!);
  const reporterIds = reports.map((r) => r.reporter_id);

  const [listings, profiles, guestbook] = await Promise.all([
    getListingsByIds(supabase, listingIds),
    listPublicProfilesByIds(supabase, [...new Set([...userIds, ...reporterIds])]),
    listGuestbookByIds(supabase, guestbookIds).catch(() => []),
  ]);
  const listingById = new Map(listings.map((l) => [l.id, l]));
  const profileById = new Map(profiles.filter((p) => p.id).map((p) => [p.id!, p]));
  const guestbookById = new Map(guestbook.map((g) => [g.id, g]));

  const items = reports.map((r) => ({
    report: r,
    listingPreview:
      r.target_type === 'listing' && r.target_id ? (listingById.get(r.target_id) ?? null) : null,
    userPreview:
      (r.target_type === 'user' || r.target_type === 'garage') && r.target_id
        ? (profileById.get(r.target_id) ?? null)
        : null,
    guestbookPreview:
      r.target_type === 'guestbook' && r.target_id && guestbookById.get(r.target_id)
        ? {
            body: guestbookById.get(r.target_id)!.body,
            hidden: guestbookById.get(r.target_id)!.hidden_by_host,
          }
        : null,
    reporterName: profileById.get(r.reporter_id)?.display_name ?? null,
  }));

  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <h2 style={{ fontSize: 18 }}>Reports queue</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        {reports.length} open report{reports.length === 1 ? '' : 's'}.
      </p>
      <AdminReportsQueueView initialItems={items} />
    </div>
  );
}
