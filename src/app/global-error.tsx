'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { THEMES } from '@/lib/theme';
import { APP_DEFAULT_THEME } from '@/lib/theme-default';

// MV-S9-06: the last-resort boundary — only reached when the ROOT layout itself throws, so it must
// render its own <html>/<body> and cannot rely on <ThemeStyles> being present. The colours come
// from the default theme's token table (the same source layout.tsx uses for themeColor) — no hex
// literals here (D-027), just no stylesheet to read them from.
const t = THEMES[APP_DEFAULT_THEME].vars;
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { boundary: 'global' } });
  }, [error]);
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: t['--bg'],
          color: t['--cream'],
        }}
      >
        <main style={{ textAlign: 'center', padding: 24, maxWidth: 420 }}>
          <h1 style={{ fontSize: 20 }}>Tiny Torque hit a snag</h1>
          <p style={{ fontSize: 14, opacity: 0.75 }}>
            The app could not start. Reload to try again — if it keeps happening we already have the
            report{error.digest ? ` (reference ${error.digest})` : ''}.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              padding: '10px 18px',
              borderRadius: 10,
              border: 0,
              background: t['--orange'],
              color: t['--btn-text'],
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
