'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_SHELL_HIDDEN_ON } from '@/lib/shell-routes';
import { initials } from '@/lib/initials';
import { createClient } from '@/lib/supabase/client';
import { BellIcon } from './icons';
import MediaImage from './MediaImage';

export default function AppHeaderClient({
  signedIn,
  displayName,
  photoMediaId,
  initialUnreadCount,
  viewerId,
}: {
  signedIn: boolean;
  displayName: string | null;
  photoMediaId: string | null;
  initialUnreadCount: number;
  viewerId: string | null;
}) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  useEffect(() => {
    if (!viewerId) return;
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [viewerId]);

  if (pathname && APP_SHELL_HIDDEN_ON.includes(pathname)) return null;

  return (
    <header>
      <Link href="/garage" className="brand-lockup" aria-label="Go to your garage">
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
