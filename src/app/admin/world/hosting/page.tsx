import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { listOpenReports } from '@/domain/trust';
import { listHostSuspensions } from '@/domain/admin';
import { getMeetupsByIds } from '@/domain/meetups';
import { getClubsByIds } from '@/domain/clubs';
import { listPublicProfilesByIds } from '@/domain/identity';
import AdminHostingView, {
  type HostingReportItem,
  type HostingSuspensionItem,
} from '@/components/AdminHostingView';

export const dynamic = 'force-dynamic';

// /admin › World › Hosting (MV-W07-05, F-28, 07 §9): the meetup and club report queues and the
// hosting suspensions with their appeal notes. Admin-gated by the layout + proxy; every write is an
// admin RPC that re-checks is_admin(). Prototype pieces only (panel, plain table, native inputs).
export default async function AdminWorldHostingPage() {
  const supabase = await createClient();
  const [reports, suspensions] = await Promise.all([
    listOpenReports(supabase)
      .then((rows) => rows.filter((r) => r.target_type === 'meetup' || r.target_type === 'club'))
      .catch(() => []),
    listHostSuspensions(supabase).catch(() => []),
  ]);

  const meetupIds = reports.filter((r) => r.target_type === 'meetup').map((r) => r.target_id ?? '');
  const clubIds = reports.filter((r) => r.target_type === 'club').map((r) => r.target_id ?? '');
  const [meetups, clubs] = await Promise.all([
    getMeetupsByIds(supabase, [...new Set(meetupIds.filter(Boolean))]).catch(() => []),
    getClubsByIds(supabase, [...new Set(clubIds.filter(Boolean))]).catch(() => []),
  ]);
  const meetupById = new Map(meetups.map((m) => [m.id, m]));
  const clubById = new Map(clubs.map((c) => [c.id, c]));

  const profiles = await listPublicProfilesByIds(supabase, [
    ...new Set([
      ...reports.map((r) => r.reporter_id),
      ...meetups.map((m) => m.host_id),
      ...clubs.map((c) => c.owner_id),
      ...suspensions.map((s) => s.user_id),
    ]),
  ]).catch(() => []);
  const nameOf = (id: string | null | undefined) => {
    const p = id ? profiles.find((x) => x.id === id) : null;
    return p ? { name: p.display_name ?? p.handle ?? 'Collector', handle: p.handle ?? null } : null;
  };

  const items: HostingReportItem[] = reports.map((r) => {
    const meetup = r.target_type === 'meetup' && r.target_id ? meetupById.get(r.target_id) : null;
    const club = r.target_type === 'club' && r.target_id ? clubById.get(r.target_id) : null;
    const subjectId = meetup?.host_id ?? club?.owner_id ?? null;
    return {
      id: r.id,
      kind: r.target_type === 'club' ? 'club' : 'meetup',
      targetName: meetup?.title ?? club?.name ?? r.target_name ?? 'Removed',
      targetHref: meetup
        ? `/world/meetups/${meetup.id}`
        : club
          ? `/world/clubs/${club.slug}`
          : null,
      targetNote: meetup
        ? `${meetup.status} · starts ${meetup.starts_at.slice(0, 16).replace('T', ' ')} UTC`
        : club
          ? `${club.join_mode} club`
          : 'no longer exists',
      subjectId,
      subject: nameOf(subjectId),
      reason: r.reason,
      notes: r.notes,
      reporter: nameOf(r.reporter_id)?.name ?? null,
      createdAt: r.created_at,
    };
  });

  const suspensionItems: HostingSuspensionItem[] = suspensions.map((s) => ({
    id: s.id,
    userId: s.user_id,
    user: nameOf(s.user_id),
    reason: s.reason,
    note: s.note,
    appealNote: s.appeal_note,
    suspendedAt: s.suspended_at,
    liftedAt: s.lifted_at,
  }));

  return (
    <div style={{ marginTop: 12 }}>
      <div className="panel">
        <h2 style={{ fontSize: 18 }}>World hosting</h2>
        <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
          Meetup and club reports, and hosting suspensions. Hosting needs level 2 and no upheld
          report in 90 days; two upheld reports suspend hosting automatically until it is lifted
          here. <Link href="/admin/world/economy">World economy</Link>
        </p>
      </div>
      <AdminHostingView initialReports={items} initialSuspensions={suspensionItems} />
    </div>
  );
}
