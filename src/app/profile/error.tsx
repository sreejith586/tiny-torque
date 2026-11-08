'use client';

import { RouteError } from '@/components/RouteStates';

// MV-S9-06: route-level error boundary for /profile/* — copy says what did not load, Sentry gets
// the exception with the area tag, Try again re-renders the segment.
export default function ErrorBoundary(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      {...props}
      area="profile"
      title="Your profile did not load"
      home="/garage"
      homeLabel="Back to my garage"
    />
  );
}
