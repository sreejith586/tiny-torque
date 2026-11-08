'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { searchUsers, setEarnFreeze, setSuspension, type AdminProfileRow } from '@/domain/admin';

function isSuspended(u: AdminProfileRow): boolean {
  return !!u.suspended_until && new Date(u.suspended_until) > new Date();
}

function UserRow({
  user,
  frozen,
  onUpdated,
  onFreezeChanged,
}: {
  user: AdminProfileRow;
  /** A world_earn_freezes row exists for this user (MV-W05-06). */
  frozen: boolean;
  onUpdated: (u: AdminProfileRow) => void;
  onFreezeChanged: (userId: string, frozen: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suspended = isSuspended(user);

  async function toggleFreeze() {
    const note = frozen
      ? null
      : window.prompt(
          `Freeze ${user.display_name}'s World earning? Add a note for the audit log:`,
          ''
        );
    if (!frozen && note === null) return;
    if (frozen && !window.confirm(`Lift ${user.display_name}'s earn freeze?`)) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const next = await setEarnFreeze(supabase, user.id, !frozen, note);
      onFreezeChanged(user.id, next);
    } catch {
      setError('Could not update the earn freeze.');
    } finally {
      setBusy(false);
    }
  }

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
            {frozen && ' · earn frozen'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ width: 'auto', padding: '8px 10px', fontSize: 12 }}
            disabled={busy}
            onClick={toggleFreeze}
          >
            {busy ? '…' : frozen ? 'Unfreeze earn' : 'Freeze earn'}
          </button>
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
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

export default function AdminUsersView({
  initialUsers,
  frozenIds = [],
}: {
  initialUsers: AdminProfileRow[];
  /** Users with an earn freeze in force (world_earn_freezes). */
  frozenIds?: string[];
}) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState(initialUsers);
  const [frozen, setFrozen] = useState(() => new Set(frozenIds));
  const [busy, setBusy] = useState(false);

  function handleFreezeChanged(userId: string, isFrozen: boolean) {
    setFrozen((prev) => {
      const next = new Set(prev);
      if (isFrozen) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }

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
        users.map((u) => (
          <UserRow
            key={u.id}
            user={u}
            frozen={frozen.has(u.id)}
            onUpdated={handleUpdated}
            onFreezeChanged={handleFreezeChanged}
          />
        ))
      )}
    </div>
  );
}
