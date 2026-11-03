'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { followUser, unfollowUser } from '@/domain/identity';

// F-14 follow button (MV-S8-07 stretch). Plain btn-secondary toggle; the follower count next to it
// updates optimistically. `follows` RLS (0002) is the backstop: a user can only ever insert/delete
// their own row.
export default function FollowButton({
  viewerId,
  targetId,
  initialFollowing,
  onCountChange,
}: {
  viewerId: string;
  targetId: string;
  initialFollowing: boolean;
  onCountChange?: (delta: 1 | -1) => void;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    try {
      if (following) {
        await unfollowUser(supabase, viewerId, targetId);
        setFollowing(false);
        onCountChange?.(-1);
      } else {
        await followUser(supabase, viewerId, targetId);
        setFollowing(true);
        onCountChange?.(1);
      }
    } catch {
      setError(following ? 'Could not unfollow.' : 'Could not follow.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={following ? 'btn-secondary' : 'btn-primary'}
        style={{ width: 'auto', padding: '8px 14px', fontSize: 12 }}
        onClick={toggle}
        disabled={busy}
        aria-pressed={following}
      >
        {busy ? '…' : following ? 'Following' : 'Follow'}
      </button>
      {error && <p className="field-error">{error}</p>}
    </>
  );
}
