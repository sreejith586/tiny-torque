'use client';

// Create-club form (MV-W07-03, F-22). One page, native inputs, inline errors — the prototype form
// pattern (D-027 rule 12), same shape as the meetup create form.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CLUB_JOIN_MODES, MAX_CLUBS_OWNED, type ClubJoinMode } from '@/domain/clubs';
import { createClubAction } from '@/app/world/clubs/actions';
import { Spinner } from '@/components/Loaders';
import { JOIN_MODE_LABEL } from './copy';

/** "JDM Collectors UAE" → "jdm_collectors_uae" (the address field's suggestion while it is untouched). */
function slugFrom(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
}

export default function ClubCreateForm({ harness = false }: { harness?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [joinMode, setJoinMode] = useState<ClubJoinMode>('open');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const address = slugTouched ? slug : slugFrom(name);
  const valid = name.trim().length >= 2 && /^[a-z0-9_]{3,24}$/.test(address);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (harness) return;
    startTransition(async () => {
      const r = await createClubAction({ name, slug: address, joinMode, description });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(`/world/clubs/${r.data.slug}`);
    });
  }

  return (
    <form onSubmit={submit} className="panel" aria-label="Start a club">
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="cl-name">Club name</label>
        <input
          id="cl-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="JDM Collectors"
          maxLength={60}
          minLength={2}
          required
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="cl-slug">Club address</label>
        <input
          id="cl-slug"
          value={address}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value.toLowerCase());
          }}
          placeholder="jdm_collectors"
          maxLength={24}
          pattern="[a-z0-9_]{3,24}"
          required
        />
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          3–24 lowercase letters, numbers or underscores. It cannot be changed later.
        </p>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="cl-join">Who can join</label>
        <select
          id="cl-join"
          value={joinMode}
          onChange={(e) => setJoinMode(e.target.value as ClubJoinMode)}
        >
          {CLUB_JOIN_MODES.map((m) => (
            <option key={m} value={m}>
              {JOIN_MODE_LABEL[m]}
            </option>
          ))}
        </select>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="cl-description">About the club (optional)</label>
        <textarea
          id="cl-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What you collect, how often you meet…"
          maxLength={500}
          rows={3}
        />
      </div>
      <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
        Starting a club is free. You can own up to {MAX_CLUBS_OWNED}. Clubs follow the community
        guidelines; members can report a club.
      </p>
      {error && <p className="field-error">{error}</p>}
      <button
        type="submit"
        className="btn-primary"
        style={{ width: '100%' }}
        disabled={pending || !valid}
      >
        {pending ? <Spinner /> : 'Start the club'}
      </button>
    </form>
  );
}
