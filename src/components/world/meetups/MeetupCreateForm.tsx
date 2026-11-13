'use client';

// Create form (MV-W06-03, F-23). One page, native inputs, inline errors — prototype form pattern
// (D-027 rule 12). The fee line explains what scheduling will cost; nothing is charged here: the
// draft is free, the fee is taken by transition_meetup('schedule') from the detail page.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MEETUP_VISIBILITIES, hostFee, type MeetupVisibility } from '@/domain/meetups';
import { createMeetupAction } from '@/app/world/meetups/actions';
import { Spinner } from '@/components/Loaders';
import { VISIBILITY_LABEL } from './copy';

const DURATIONS = [30, 45, 60, 90, 120, 180];

export default function MeetupCreateForm({
  cap,
  level,
  levelName,
  isPro,
  defaultStartsAt,
  clubs = [],
  defaultClubId = null,
  harness = false,
}: {
  cap: number;
  level: number;
  levelName: string;
  isPro: boolean;
  /** `datetime-local` value the Starts field opens with (computed by the page: two days out). */
  defaultStartsAt: string;
  /** Clubs the caller is owner / admin of (W07): "Host as" lists them; empty = no such field. */
  clubs?: { id: string; name: string }[];
  /** Preselected club (the clubhouse's "Host a club meetup" link). */
  defaultClubId?: string | null;
  /** Fixture harness: the submit button stays enabled but never calls the server. */
  harness?: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState(defaultStartsAt);
  const [duration, setDuration] = useState(90);
  const [capacity, setCapacity] = useState(Math.min(10, Math.max(2, cap)));
  const [visibility, setVisibility] = useState<MeetupVisibility>('public');
  const [clubId, setClubId] = useState(
    defaultClubId && clubs.some((c) => c.id === defaultClubId) ? defaultClubId : ''
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fee = hostFee(capacity);
  const canHost = cap > 0;
  // "Club members only" needs a club to host for (the RPC requires owner / admin of it)
  const options = MEETUP_VISIBILITIES.filter((v) => v !== 'club' || clubId !== '');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (harness) return;
    const startsIso = new Date(startsAt).toISOString();
    startTransition(async () => {
      const r = await createMeetupAction({
        title,
        theme,
        description,
        startsAt: startsIso,
        durationMinutes: duration,
        capacity,
        visibility,
        clubId: clubId || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(`/world/meetups/${r.data.id}`);
    });
  }

  if (!canHost) {
    return (
      <div className="panel">
        <p className="muted" style={{ fontSize: 13 }}>
          Your garage is level {level} · {levelName}. Hosting opens at level 2 —{' '}
          <Link href="/world/shop">level up in the World shop</Link>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="panel" aria-label="Host a meetup">
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="mt-title">Title</label>
        <input
          id="mt-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="JDM night"
          maxLength={80}
          required
          minLength={3}
        />
      </div>
      {clubs.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="mt-club">Host as</label>
          <select
            id="mt-club"
            value={clubId}
            onChange={(e) => {
              setClubId(e.target.value);
              if (!e.target.value && visibility === 'club') setVisibility('public');
            }}
          >
            <option value="">My garage</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (club)
              </option>
            ))}
          </select>
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="mt-theme">Theme (optional)</label>
        <input
          id="mt-theme"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="Treasure Hunt show-and-tell"
          maxLength={60}
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="mt-description">Description (optional)</label>
        <textarea
          id="mt-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What to bring, what we’ll talk about…"
          maxLength={1000}
          rows={3}
        />
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="mt-starts">Starts</label>
          <input
            id="mt-starts"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
        </div>
        <div style={{ width: 130 }}>
          <label htmlFor="mt-duration">Length</label>
          <select
            id="mt-duration"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            {DURATIONS.map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} min` : `${m / 60} h`}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 130 }}>
          <label htmlFor="mt-capacity">Seats</label>
          <input
            id="mt-capacity"
            type="number"
            min={2}
            max={cap}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            required
          />
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor="mt-visibility">Who can join</label>
          <select
            id="mt-visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as MeetupVisibility)}
          >
            {options.map((v) => (
              <option key={v} value={v}>
                {VISIBILITY_LABEL[v]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
        Your level {level} · {levelName} garage hosts up to {cap} seats{isPro ? ' (Pro +50 %)' : ''}
        . Scheduling costs a {fee}-credit hosting fee (refunded if you cancel 24 h or more before
        the start). Joining is always free.
      </p>
      <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
        In-person meetups arrive in a later update.
      </p>
      {error && <p className="field-error">{error}</p>}
      <button
        type="submit"
        className="btn-primary"
        style={{ width: '100%' }}
        disabled={pending || !startsAt || title.trim().length < 3 || capacity < 2 || capacity > cap}
      >
        {pending ? <Spinner /> : 'Save draft'}
      </button>
    </form>
  );
}
