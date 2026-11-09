import { PageLoading } from '@/components/RouteStates';

// MV-S9-06: loading boundary for /garage/import.
export default function Loading() {
  return <PageLoading title="Preparing the import…" />;
}
