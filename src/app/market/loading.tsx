import { GridLoading } from '@/components/RouteStates';

// MV-S9-06: loading boundary for /market (first page) — placeholder cards in the real grid.
// Only here, not on /market/[id]: a loading.tsx above a notFound() page turns its 404 into a 200 shell.
export default function Loading() {
  return <GridLoading title="Loading the market…" />;
}
