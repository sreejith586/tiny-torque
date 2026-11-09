'use client';

import { useEffect, useState } from 'react';

// MV-S9-02 (F-17): the read-only offline banner. The service worker serves the last garage page
// (and /offline for everything else) when the network is gone; this tells the collector why
// nothing saves. Same `.thread-banner` the deal chat already uses for its offline line (D-027: an
// existing piece, not a new component). Rendered at the top of the app shell, under the header.
export default function OfflineBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (online) return null;
  return (
    <div
      className="thread-banner"
      role="status"
      aria-live="polite"
      style={{ margin: '8px 16px 0' }}
      data-offline-banner=""
    >
      You&apos;re offline — showing your last saved garage, read-only. Changes will work again once
      you&apos;re back online.
    </div>
  );
}
