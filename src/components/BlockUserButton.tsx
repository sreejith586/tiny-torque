'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { blockUser } from '@/domain/trust';

export default function BlockUserButton({
  viewerId,
  targetId,
  targetName,
}: {
  viewerId: string;
  targetId: string;
  targetName: string;
}) {
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (blocked) {
    return (
      <p className="muted" style={{ fontSize: 12 }}>
        Blocked — you won&apos;t see each other&apos;s listings or profile anymore.
      </p>
    );
  }

  async function handleBlock() {
    if (
      !window.confirm(
        `Block ${targetName}? You won't see each other's listings, profile, offers or messages anymore.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      await blockUser(supabase, viewerId, targetId);
      setBlocked(true);
    } catch {
      setError('Could not block this user.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn-secondary"
        style={{ width: 'auto', padding: '8px 10px', fontSize: 12 }}
        onClick={handleBlock}
        disabled={busy}
      >
        {busy ? '…' : 'Block user'}
      </button>
      {error && <p className="field-error">{error}</p>}
    </>
  );
}
