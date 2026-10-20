'use client';

import { useEffect, useState } from 'react';
import { TrophyIcon } from './icons';

// MV-S8-03: the "badge unlocked" toast. The sync that ran during this page's render reports which
// badges unlocked just now; show them one at a time, auto-dismiss, tap to skip. The matching
// notification row (badge_unlocked) is written by apply_gamification, so the bell catches up too.
export default function BadgeUnlockToast({
  unlocked,
}: {
  unlocked: { key: string; name: string }[];
}) {
  const [index, setIndex] = useState(0);
  const current = unlocked[index];

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => setIndex((i) => i + 1), 4500);
    return () => clearTimeout(t);
  }, [current]);

  if (!current) return null;

  return (
    <div
      className="unlock-toast"
      role="status"
      aria-live="polite"
      onClick={() => setIndex((i) => i + 1)}
    >
      <div className="badge-icon" style={{ width: 40, height: 40 }}>
        <TrophyIcon size={20} />
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Badge unlocked</div>
        <div className="muted" style={{ fontSize: 12 }}>
          {current.name}
        </div>
      </div>
    </div>
  );
}
