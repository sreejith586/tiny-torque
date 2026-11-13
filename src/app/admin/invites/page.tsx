import { createClient } from '@/lib/supabase/server';
import { listInvites } from '@/domain/admin';
import AdminInvitesView from '@/components/AdminInvitesView';

export const dynamic = 'force-dynamic';

// /admin › Invites (MV-S10-04, F-16 "Invites (create codes/cohorts)"). Reads `invites` under its
// admin-only RLS. Prototype pieces only: panel, native inputs, btn-primary / btn-secondary, plain
// table (D-027 rule 12).
export default async function AdminInvitesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const invites = await listInvites(supabase).catch(() => []);

  return (
    <div style={{ marginTop: 12 }}>
      <div className="panel">
        <h2 style={{ fontSize: 18 }}>Invites</h2>
        <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
          One batch of codes per cohort. A code works until its seats are used or it expires; the
          cohort name travels with every sign-up so the weekly report can split by it.
        </p>
      </div>
      <AdminInvitesView adminId={user?.id ?? ''} initial={invites} />
    </div>
  );
}
