'use client';

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
}: {
  signedIn: boolean;
  displayName: string | null;
  photoMediaId: string | null;
}) {
  const pathname = usePathname();
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
        <Link href="/offers" className="icon-btn notif-bell" aria-label="Deals">
          <BellIcon size={17} />
        </Link>
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
