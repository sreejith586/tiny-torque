// Shared gate for the /world/clubs pages (MV-W07-03). Fixture harness (?__visual=1, never in
// production) → fixtures; otherwise session → `world` + `world_clubs` flags (→ 404 while dark,
// D-028) → real data through domain/clubs.
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Client } from '@/lib/supabase/types';
import { isFlagEnabled } from '@/domain/flags';
import { isVisualHarness } from '@/lib/visual-fixtures';
import type { SearchParams } from '../meetups/_data';

export { harnessHref, type SearchParams } from '../meetups/_data';

export type ClubsGate =
  | { harness: true; supabase: null; userId: null; meetupsOn: true }
  | { harness: false; supabase: Client; userId: string; meetupsOn: boolean };

export async function gateClubs(searchParams: SearchParams, next: string): Promise<ClubsGate> {
  if (isVisualHarness(searchParams))
    return { harness: true, supabase: null, userId: null, meetupsOn: true };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const ctx = { userId: user.id };
  if (!(await isFlagEnabled(supabase, 'world', ctx))) notFound();
  if (!(await isFlagEnabled(supabase, 'world_clubs', ctx))) notFound();
  const meetupsOn = await isFlagEnabled(supabase, 'world_meetups', ctx);
  return { harness: false, supabase, userId: user.id, meetupsOn };
}
