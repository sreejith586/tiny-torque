import { PageLoading } from '@/components/RouteStates';

// MV-S9-06: loading boundary for /tokens/history.
export default function Loading() {
  return <PageLoading title="Loading your token history…" />;
}
