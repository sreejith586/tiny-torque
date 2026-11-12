'use client';

import { RouteError } from '@/components/RouteStates';

// MV-S9-06: route-level error boundary for /admin/* — copy says what did not load, Sentry gets
// the exception with the area tag, Try again re-renders the segment.
export default function ErrorBoundary(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      {...props}
      area="admin"
      title="The admin console did not load"
      home="/garage"
      homeLabel="Back to my garage"
    />
  );
}
