import { PageLoading } from '@/components/RouteStates';

// MV-S9-06: loading boundary for /market/mine.
export default function Loading() {
  return <PageLoading title="Loading your listings…" />;
}
