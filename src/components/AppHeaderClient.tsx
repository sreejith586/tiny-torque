'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_SHELL_HIDDEN_ON } from '@/lib/shell-routes';
import { initials } from '@/lib/initials';
import { BellIcon } from './icons';
import MediaImage from './MediaImage';

export default function AppHeaderClient({
  signedIn,
  displayName,
  photoMediaId,
  initialUnreadCount,
  initialTokens,
  viewerId,
}: {
  signedIn: boolean;
  displayName: string | null;
  photoMediaId: string | null;
  initialUnreadCount: number;
  initialTokens: number;
  viewerId: string | null;
}) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [tokens, setTokens] = useState(initialTokens);

  useEffect(() => {
    if (!viewerId) return;
    // MV-S9-03: the header is on every route, so supabase-js (realtime + phoenix, ~65 KB gz) is
    // loaded here on demand after hydration instead of inside the shared first-load bundle.
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    import('@/lib/supabase/client').then(({ createClient }) => {
      if (cancelled) return;
      const supabase = createClient();
      const channel = supabase
        .channel(`header-notifications-${viewerId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${viewerId}`,
          },
          () => setUnreadCount((n) => n + 1)
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${viewerId}`,
          },
          // recompute_token_balance (MV-S7-01) updates profiles.tokens whenever the ledger moves.
          (payload) => setTokens((payload.new as { tokens?: number }).tokens ?? 0)
        )
        .subscribe();
      cleanup = () => {
        supabase.removeChannel(channel);
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [viewerId]);

  if (pathname && APP_SHELL_HIDDEN_ON.includes(pathname)) return null;

  return (
    <header>
      {/* Accessible name = the visible lockup text (axe label-content-name-mismatch, MV-S9-04);
          the destination is a tooltip, not the name. */}
      <Link href="/garage" className="brand-lockup" title="Go to your garage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-logo" src="/tiny-torque-logo.webp" alt="" width={40} height={40} />
        <span className="brand-text">
          <span className="brand-name">TINY TORQUE</span>
          <span className="brand-tagline">DIECAST COLLECTOR</span>
        </span>
      </Link>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {signedIn && (
          <Link
            href="/tokens"
            className="btn-secondary"
            aria-label={`${tokens} tokens — buy more`}
            style={{ width: 'auto', padding: '6px 12px', fontSize: 13, fontWeight: 700 }}
          >
            {tokens}
          </Link>
        )}
        {signedIn && (
          <Link
            href="/notifications"
            className="icon-btn notif-bell"
            aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
            style={{ position: 'relative' }}
          >
            <BellIcon size={17} />
            {unreadCount > 0 && (
              <span
                className="notif-dot"
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  minWidth: 14,
                  height: 14,
                  padding: '0 3px',
                  borderRadius: 7,
                  background: 'var(--danger)',
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        )}
        {signedIn ? (
          <Link href="/profile" className="header-avatar-btn" aria-label="Profile">
            {photoMediaId ? (
              <MediaImage
                mediaId={photoMediaId}
                alt=""
                width={96}
                priority
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <span className="header-avatar-initial">{initials(displayName)}</span>
            )}
          </Link>
        ) : (
          <Link
            href={`/login?next=${encodeURIComponent(pathname || '/garage')}`}
            className="btn-secondary"
            style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }}
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
