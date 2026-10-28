// Server-only: is the Collectors World tab on for this request's user? Read once in the root
// layout and handed to <BottomNav> (MV-W02-01). Best-effort: any failure (no session, flags table
// unreachable on an old environment) means "off" — the bar must never break because of a flag.
import { createClient } from '@/lib/supabase/server';
import { isFlagEnabled } from '@/domain/flags';

export async function worldNavEnabled(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    return await isFlagEnabled(supabase, 'world', { userId: user.id });
  } catch {
    return false;
  }
}
