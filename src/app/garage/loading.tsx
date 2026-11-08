import { GridLoading } from '@/components/RouteStates';

// MV-S9-06: loading boundary for /garage (first page) — placeholder cards in the real grid.
// Only here, not on /garage/[id]: a loading.tsx above a notFound() page turns its 404 into a 200 shell.
export default function Loading() {
  return <GridLoading title="Opening your garage…" />;
}
