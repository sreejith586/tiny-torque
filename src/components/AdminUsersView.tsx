'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { searchUsers, setSuspension, type AdminProfileRow } from '@/domain/admin';

function isSuspended(u: AdminProfileRow): boolean {
  return !!u.suspended_until && new Date(u.suspended_until) > new Date();
}

function UserRow({
  user,
  onUpdated,
}: {
  user: AdminProfileRow;
  onUpdated: (u: AdminProfileRow) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suspended = isSuspended(user);

  async function toggleSuspend() {
    const confirmMsg = suspended
      ? `Lift ${user.display_name}'s suspension?`
      : `Suspend ${user.display_name} for 7 days?`;
    if (!window.confirm(confirmMsg)) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const updated = await setSuspension(supabase, user.id, suspended ? 0 : 7);
      onUpdated(updated);
    } catch {
      setError('Could not update this user.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel" style={{ marginBottom: 8 }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
      >
        <div>
          <div style={{ fontWeight: 600 }}>
            {user.display_name} <span className="muted">@{user.handle}</span>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            {user.account_type} · {user.mobile ?? 'no mobile on file'}
            {suspended &&
              ` · suspended until ${new Date(user.suspended_until!).toLocaleDateString()}`}
          </div>
        </div>
        <button
          type="button"
          className={suspended ? 'btn-secondary' : 'btn-danger'}
          style={{ width: 'auto', padding: '8px 10px', fontSize: 12 }}
          disabled={busy}
          onClick={toggleSuspend}
        >
          {busy ? '…' : suspended ? 'Unsuspend' : 'Suspend'}
        </button>
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

export default function AdminUsersView({ initialUsers }: { initialUsers: AdminProfileRow[] }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState(initialUsers);
  const [busy, setBusy] = useState(false);

  async function handleSearch() {
    setBusy(true);
    try {
      const supabase = createClient();
      setUsers(await searchUsers(supabase, query, 20));
    } finally {
      setBusy(false);
    }
  }

  function handleUpdated(updated: AdminProfileRow) {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          placeholder="Name, handle or mobile…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button
          type="button"
          className="btn-secondary"
          style={{ width: 'auto', padding: '8px 14px' }}
          disabled={busy}
          onClick={handleSearch}
        >
          {busy ? '…' : 'Search'}
        </button>
      </div>
      {users.length === 0 ? (
        <p className="muted">No users found.</p>
      ) : (
        users.map((u) => <UserRow key={u.id} user={u} onUpdated={handleUpdated} />)
      )}
    </div>
  );
}
