import { createClient } from '@/lib/supabase/server';
import { listEarnFreezes, searchUsers } from '@/domain/admin';
import AdminUsersView from '@/components/AdminUsersView';

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const [users, freezes] = await Promise.all([
    searchUsers(supabase, '', 20),
    listEarnFreezes(supabase).catch(() => []),
  ]);

  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <h2 style={{ fontSize: 18 }}>Users</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Search by name, handle or mobile number. Freeze earn stops a user&apos;s World token earning
        (quests still track); the global freeze is the <code>world_earn</code> flag.
      </p>
      <AdminUsersView initialUsers={users} frozenIds={freezes.map((f) => f.user_id)} />
    </div>
  );
}
