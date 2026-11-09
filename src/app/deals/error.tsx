'use client';

import { RouteError } from '@/components/RouteStates';

// MV-S9-06: route-level error boundary for /deals/* — copy says what did not load, Sentry gets
// the exception with the area tag, Try again re-renders the segment.
export default function ErrorBoundary(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      {...props}
      area="deals"
      title="This deal did not load"
      home="/offers"
      homeLabel="Back to deals"
    />
  );
}
