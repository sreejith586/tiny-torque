import { createClient } from '@/lib/supabase/server';
import { searchUsers } from '@/domain/admin';
import AdminUsersView from '@/components/AdminUsersView';

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const users = await searchUsers(supabase, '', 20);

  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <h2 style={{ fontSize: 18 }}>Users</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Search by name, handle or mobile number.
      </p>
      <AdminUsersView initialUsers={users} />
    </div>
  );
}
