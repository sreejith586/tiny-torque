'use client';

import { useState, useTransition } from 'react';
import type { FlagAdminRow } from '@/domain/flags';
import { updateFlagAction } from '@/app/admin/flags/actions';

// MV-W01-09 (F-16 Flags). One row per flag: the kill-switch toggle plus the two audience helpers
// the World rollout needs (country, cohort = user ids). Other audience keys (plans, percent) are
// preserved untouched when saving. Prototype pieces only: toggle-row, native inputs, btn-secondary.

type Group = { id: string; label: string; keys: string[] };

function parseList(raw: string) {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function FlagRowEditor({ flag }: { flag: FlagAdminRow }) {
  const [enabled, setEnabled] = useState(flag.enabled);
  const [countries, setCountries] = useState((flag.audience.countries ?? []).join(', '));
  const [userIds, setUserIds] = useState((flag.audience.user_ids ?? []).join('\n'));
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save(nextEnabled: boolean) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateFlagAction({
        key: flag.key,
        enabled: nextEnabled,
        audience: {
          ...flag.audience,
          countries: parseList(countries).map((c) => c.toUpperCase()),
          user_ids: parseList(userIds),
        },
      });
      if (res.ok) setSaved(true);
      else setError(res.error);
    });
  }

  const audienceSummary = [
    flag.audience.countries?.length ? `countries: ${flag.audience.countries.join(', ')}` : null,
    flag.audience.user_ids?.length ? `${flag.audience.user_ids.length} user id(s)` : null,
    flag.audience.plans?.length ? `plans: ${flag.audience.plans.join(', ')}` : null,
    typeof flag.audience.percent === 'number' ? `${flag.audience.percent}%` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
      <label className="toggle-row" style={{ margin: 0 }}>
        <span>
          <span style={{ display: 'block', fontWeight: 700 }}>{flag.key}</span>
          {flag.description && (
            <span className="muted" style={{ display: 'block', fontSize: 12 }}>
              {flag.description}
            </span>
          )}
          <span className="muted" style={{ display: 'block', fontSize: 12 }}>
            {audienceSummary || 'everyone (once enabled)'}
          </span>
        </span>
        <input
          type="checkbox"
          checked={enabled}
          disabled={pending}
          onChange={(e) => {
            setEnabled(e.target.checked);
            save(e.target.checked);
          }}
          aria-label={`${flag.key} enabled`}
        />
      </label>

      <button
        type="button"
        className="btn-secondary"
        style={{ marginTop: 6, fontSize: 12, padding: '4px 10px' }}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? 'Hide audience' : 'Edit audience'}
      </button>

      {open && (
        <div style={{ marginTop: 8 }}>
          <label htmlFor={`${flag.key}-countries`}>Countries (ISO codes, comma-separated)</label>
          <input
            id={`${flag.key}-countries`}
            value={countries}
            onChange={(e) => setCountries(e.target.value)}
            placeholder="AE, IN"
          />
          <label htmlFor={`${flag.key}-users`}>Cohort — user ids (one per line)</label>
          <textarea
            id={`${flag.key}-users`}
            rows={3}
            value={userIds}
            onChange={(e) => setUserIds(e.target.value)}
            placeholder="founders cohort uuids"
          />
          <button
            type="button"
            className="btn-secondary"
            disabled={pending}
            onClick={() => save(enabled)}
          >
            {pending ? 'Saving…' : 'Save audience'}
          </button>
        </div>
      )}

      {error && <p className="field-error">{error}</p>}
      {saved && !error && (
        <p className="muted" style={{ fontSize: 12 }}>
          Saved.
        </p>
      )}
    </div>
  );
}

export default function AdminFlagsView({
  groups,
  flags,
}: {
  groups: Group[];
  flags: FlagAdminRow[];
}) {
  const byKey = new Map(flags.map((f) => [f.key, f]));
  const grouped = groups.map((g) => ({
    ...g,
    flags: g.keys.map((k) => byKey.get(k)).filter(Boolean) as FlagAdminRow[],
  }));
  const known = new Set(groups.flatMap((g) => g.keys));
  const other = flags.filter((f) => !known.has(f.key));

  return (
    <div>
      {grouped.map((g) => (
        <section key={g.id} style={{ marginTop: 14 }}>
          <h3 style={{ fontSize: 15, marginBottom: 6 }}>{g.label}</h3>
          {g.flags.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>
              Not seeded in this environment yet.
            </p>
          ) : (
            g.flags.map((f) => <FlagRowEditor key={f.key} flag={f} />)
          )}
        </section>
      ))}
      {other.length > 0 && (
        <section style={{ marginTop: 14 }}>
          <h3 style={{ fontSize: 15, marginBottom: 6 }}>Other</h3>
          {other.map((f) => (
            <FlagRowEditor key={f.key} flag={f} />
          ))}
        </section>
      )}
    </div>
  );
}
