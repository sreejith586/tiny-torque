import { createClient } from '@/lib/supabase/server';
import { listOpenReports } from '@/domain/trust';
import { getListingsByIds } from '@/domain/marketplace';
import { listPublicProfilesByIds } from '@/domain/identity';
import AdminReportsQueueView from '@/components/AdminReportsQueueView';

export default async function AdminReportsPage() {
  const supabase = await createClient();
  const reports = await listOpenReports(supabase);

  const listingIds = reports
    .filter((r) => r.target_type === 'listing' && r.target_id)
    .map((r) => r.target_id!);
  const userIds = reports
    .filter((r) => r.target_type === 'user' && r.target_id)
    .map((r) => r.target_id!);
  const reporterIds = reports.map((r) => r.reporter_id);

  const [listings, profiles] = await Promise.all([
    getListingsByIds(supabase, listingIds),
    listPublicProfilesByIds(supabase, [...new Set([...userIds, ...reporterIds])]),
  ]);
  const listingById = new Map(listings.map((l) => [l.id, l]));
  const profileById = new Map(profiles.filter((p) => p.id).map((p) => [p.id!, p]));

  const items = reports.map((r) => ({
    report: r,
    listingPreview:
      r.target_type === 'listing' && r.target_id ? (listingById.get(r.target_id) ?? null) : null,
    userPreview:
      r.target_type === 'user' && r.target_id ? (profileById.get(r.target_id) ?? null) : null,
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
