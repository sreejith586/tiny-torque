import { PageLoading } from '@/components/RouteStates';

// MV-S9-06: loading boundary for /admin.
export default function Loading() {
  return <PageLoading title="Loading the admin console…" />;
}
