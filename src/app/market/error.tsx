'use client';

import { RouteError } from '@/components/RouteStates';

// MV-S9-06: route-level error boundary for /market/* — copy says what did not load, Sentry gets
// the exception with the area tag, Try again re-renders the segment.
export default function ErrorBoundary(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      {...props}
      area="market"
      title="The market did not load"
      home="/market"
      homeLabel="Back to the market"
    />
  );
}
