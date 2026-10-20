import { createClient } from '@/lib/supabase/server';
import { listFlagsForAdmin, FLAG_GROUPS } from '@/domain/flags';
import AdminFlagsView from '@/components/AdminFlagsView';

export const dynamic = 'force-dynamic';

// F-16 "Flags (toggle + audience JSON with validation)" — MV-W01-09 adds the Collectors World
// group. Composed from the prototype's existing pieces only (panel / toggle-row / native inputs /
// btn-secondary), D-027 rule 12.
export default async function AdminFlagsPage() {
  const supabase = await createClient();
  const flags = await listFlagsForAdmin(supabase);

  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <h2 style={{ fontSize: 18 }}>Feature flags</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Enabled is the kill switch. Countries and user ids narrow who an enabled flag reaches
        (D-018). World flags ship OFF; <code>world_shop</code> + <code>world_earn</code> together
        are the economy freeze.
      </p>
      <AdminFlagsView
        groups={FLAG_GROUPS.map((g) => ({ id: g.id, label: g.label, keys: [...g.keys] }))}
        flags={flags}
      />
    </div>
  );
}
