'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { LoaderDots } from './Loaders';

// MV-S9-06 (F-17 "route-level loading states", 05 S9 "every route has loading.tsx, error.tsx,
// empty state; Sentry breadcrumbs; user-facing error copy; retry affordances"). The two shared
// surfaces every segment's loading.tsx / error.tsx render — composed only from the prototype's
// pieces (panel, muted, btn-primary/secondary, the D-045 loader dots), D-027. Copy is per area so
// the message says what did not load, never a stack trace.

export function PageLoading({ title }: { title: string }) {
  return (
    <main style={{ padding: '20px 16px', flex: 1 }} aria-busy="true">
      <div className="panel" style={{ textAlign: 'center', padding: 28 }}>
        <p className="muted" style={{ fontSize: 13 }}>
          {title}
        </p>
        <LoaderDots />
      </div>
    </main>
  );
}

/** Skeleton for card grids (garage / market): six placeholder cards in the real grid so the layout
 *  does not jump when the data arrives. Pure CSS tokens, no new component (uses .garage-grid). */
export function GridLoading({ title }: { title: string }) {
  return (
    <main style={{ padding: '20px 16px', flex: 1 }} aria-busy="true">
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        {title}
      </p>
      <div className="garage-grid" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="panel"
            style={{
              aspectRatio: '4 / 5',
              padding: 0,
              background: 'color-mix(in srgb, var(--panel-alt) 70%, transparent)',
            }}
          />
        ))}
      </div>
      <LoaderDots />
    </main>
  );
}

export function RouteError({
  error,
  reset,
  area,
  title,
  home = '/garage',
  homeLabel = 'Back to my garage',
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** Sentry tag + breadcrumb category, e.g. "garage", "market". */
  area: string;
  /** What did not load, in the collector's words: "Your garage did not load". */
  title: string;
  home?: string;
  homeLabel?: string;
}) {
  useEffect(() => {
    Sentry.addBreadcrumb({
      category: 'route',
      level: 'error',
      message: `${area}: error boundary shown`,
      data: { digest: error.digest ?? null },
    });
    Sentry.captureException(error, { tags: { area, boundary: 'route' } });
  }, [error, area]);

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <div className="panel" style={{ textAlign: 'center' }} role="alert">
        <h2 style={{ fontSize: 16 }}>{title}</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          Something went wrong on our side. Try again in a moment — nothing you did was lost.
        </p>
        {error.digest && (
          <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>
            Reference {error.digest}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14 }}>
          <button type="button" className="btn-primary" style={{ width: 'auto' }} onClick={reset}>
            Try again
          </button>
          <Link href={home} className="btn-secondary" style={{ width: 'auto' }}>
            {homeLabel}
          </Link>
        </div>
      </div>
    </main>
  );
}

/** Inline retry row for client-side list fetches (infinite queries) — same copy shape as RouteError
 *  without taking the whole page down. */
export function InlineRetry({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="panel" style={{ textAlign: 'center', marginTop: 12 }} role="alert">
      <p className="muted" style={{ fontSize: 13 }}>
        {message}
      </p>
      <button
        type="button"
        className="btn-secondary"
        style={{ width: 'auto', marginTop: 10 }}
        onClick={onRetry}
      >
        Try again
      </button>
    </div>
  );
}
