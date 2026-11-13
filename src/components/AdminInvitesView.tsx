'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  createInvites,
  createInvitesSchema,
  expireInvite,
  inviteCohortSummary,
  isInviteOpen,
  type InviteRow,
} from '@/domain/admin';

// /admin/invites (MV-S10-04, F-16). A single-page form (cohort, how many, seats, expiry) and two
// plain tables — per cohort, then every code. Prototype pieces only (D-027 rule 12).

const cell: React.CSSProperties = { padding: '6px 8px', textAlign: 'left', whiteSpace: 'nowrap' };
const head: React.CSSProperties = { ...cell, fontSize: 12, color: 'var(--muted)', fontWeight: 600 };

function status(inv: InviteRow): string {
  if (inv.used_count >= inv.max_uses) return 'used up';
  if (inv.expires_at && new Date(inv.expires_at) <= new Date()) return 'expired';
  return 'open';
}

export default function AdminInvitesView({
  adminId,
  initial,
}: {
  adminId: string;
  initial: InviteRow[];
}) {
  const [invites, setInvites] = useState<InviteRow[]>(initial);
  const [cohort, setCohort] = useState('');
  const [count, setCount] = useState('10');
  const [maxUses, setMaxUses] = useState('1');
  const [expiresInDays, setExpiresInDays] = useState('30');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<InviteRow[]>([]);

  const cohorts = useMemo(() => inviteCohortSummary(invites), [invites]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const input = { cohort, count, maxUses, expiresInDays: expiresInDays || 0 };
    const parsed = createInvitesSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form.');
      return;
    }
    setBusy(true);
    try {
      const rows = await createInvites(createClient(), adminId, input);
      setFresh(rows);
      setInvites((prev) => [...rows, ...prev]);
    } catch {
      setError('Could not create the codes. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function expire(code: string) {
    if (!window.confirm(`End invite ${code} now? Seats already used stay used.`)) return;
    setError(null);
    try {
      const row = await expireInvite(createClient(), adminId, code);
      setInvites((prev) => prev.map((i) => (i.code === code ? row : i)));
    } catch {
      setError('Could not end that code.');
    }
  }

  return (
    <div>
      <div className="section-title">Create codes</div>
      <form className="panel" onSubmit={create}>
        <label htmlFor="inviteCohort">Cohort</label>
        <input
          id="inviteCohort"
          value={cohort}
          onChange={(e) => setCohort(e.target.value)}
          placeholder="uae-collectors"
          autoComplete="off"
          list="inviteCohortList"
          required
        />
        <datalist id="inviteCohortList">
          {cohorts
            .filter((c) => c.cohort !== '—')
            .map((c) => (
              <option key={c.cohort} value={c.cohort} />
            ))}
        </datalist>
        <label htmlFor="inviteCount" style={{ marginTop: 10 }}>
          How many codes
        </label>
        <input
          id="inviteCount"
          type="number"
          inputMode="numeric"
          min={1}
          max={100}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          required
        />
        <label htmlFor="inviteSeats" style={{ marginTop: 10 }}>
          Sign-ups per code
        </label>
        <input
          id="inviteSeats"
          type="number"
          inputMode="numeric"
          min={1}
          max={500}
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value)}
          required
        />
        <label htmlFor="inviteExpiry" style={{ marginTop: 10 }}>
          Expires after (days, 0 = never)
        </label>
        <input
          id="inviteExpiry"
          type="number"
          inputMode="numeric"
          min={0}
          max={365}
          value={expiresInDays}
          onChange={(e) => setExpiresInDays(e.target.value)}
        />
        {error && <p className="field-error">{error}</p>}
        <button type="submit" className="btn-primary" disabled={busy} style={{ marginTop: 12 }}>
          {busy ? 'Creating…' : 'Create codes'}
        </button>
      </form>

      {fresh.length > 0 && (
        <>
          <div className="section-title">New codes — copy them into your invite messages</div>
          <div className="panel">
            <textarea
              readOnly
              aria-label="New invite codes"
              rows={Math.min(fresh.length, 10)}
              value={fresh.map((i) => i.code).join('\n')}
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
        </>
      )}

      <div className="section-title">Cohorts</div>
      <div className="panel" style={{ overflowX: 'auto' }}>
        {cohorts.length === 0 ? (
          <p className="muted">No invite codes yet.</p>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={head}>Cohort</th>
                <th style={head}>Codes</th>
                <th style={head}>Open</th>
                <th style={head}>Signed up / seats</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.cohort} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={cell}>{c.cohort}</td>
                  <td style={cell}>{c.codes}</td>
                  <td style={cell}>{c.open}</td>
                  <td style={cell}>
                    {c.used} / {c.seats}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section-title">All codes</div>
      <div className="panel" style={{ overflowX: 'auto' }}>
        {invites.length === 0 ? (
          <p className="muted">Nothing here yet.</p>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={head}>Code</th>
                <th style={head}>Cohort</th>
                <th style={head}>Used</th>
                <th style={head}>Expires</th>
                <th style={head}>Status</th>
                <th style={head} />
              </tr>
            </thead>
            <tbody>
              {invites.map((i) => (
                <tr key={i.code} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={cell}>
                    <code>{i.code}</code>
                  </td>
                  <td style={cell}>{i.cohort ?? '—'}</td>
                  <td style={cell}>
                    {i.used_count} / {i.max_uses}
                  </td>
                  <td style={cell}>{i.expires_at ? i.expires_at.slice(0, 10) : 'never'}</td>
                  <td style={cell}>{status(i)}</td>
                  <td style={cell}>
                    {isInviteOpen(i) && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => expire(i.code)}
                      >
                        End
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
