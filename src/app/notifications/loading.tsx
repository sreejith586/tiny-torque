import { PageLoading } from '@/components/RouteStates';

// MV-S9-06: loading boundary for /notifications.
export default function Loading() {
  return <PageLoading title="Loading your notifications…" />;
}
