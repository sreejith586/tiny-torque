// Shared gate for the /world/meetups pages (MV-W06-03/04). Fixture harness (?__visual=1, never in
// production) → fixtures; otherwise session → `world` + `world_meetups` flags (→ 404 while dark,
// D-028) → real data through domain/meetups.
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Client } from '@/lib/supabase/types';
import { isFlagEnabled } from '@/domain/flags';
import { isVisualHarness } from '@/lib/visual-fixtures';

export type SearchParams = Record<string, string | string[] | undefined>;

export type MeetupsGate =
  | { harness: true; supabase: null; userId: null }
  | { harness: false; supabase: Client; userId: string };

export async function gateMeetups(searchParams: SearchParams, next: string): Promise<MeetupsGate> {
  if (isVisualHarness(searchParams)) return { harness: true, supabase: null, userId: null };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const ctx = { userId: user.id };
  if (!(await isFlagEnabled(supabase, 'world', ctx))) notFound();
  if (!(await isFlagEnabled(supabase, 'world_meetups', ctx))) notFound();
  return { harness: false, supabase, userId: user.id };
}

/** Keeps the fixture harness on across in-app links (preview review, Playwright). */
export function harnessHref(searchParams: SearchParams, href: string): string {
  if (!isVisualHarness(searchParams)) return href;
  const as = typeof searchParams.as === 'string' ? `&as=${searchParams.as}` : '';
  return `${href}${href.includes('?') ? '&' : '?'}__visual=1${as}`;
}
