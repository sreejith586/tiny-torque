'use server';

// MV-W01-09: the /admin flags editor's one write. Admin-gated three times over (proxy redirect,
// admin layout, RLS update policy); the service validates the audience shape with zod and logs a
// flag.updated event. Plain exported action so the client view can show an inline error.
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { updateFlag } from '@/domain/flags';

export type UpdateFlagResult = { ok: true } | { ok: false; error: string };

export async function updateFlagAction(input: {
  key: string;
  enabled: boolean;
  audience: {
    countries?: string[];
    user_ids?: string[];
    plans?: Array<'free' | 'pro'>;
    percent?: number;
  };
}): Promise<UpdateFlagResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  try {
    await updateFlag(supabase, user.id, input);
    revalidatePath('/admin/flags');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not save that flag.',
    };
  }
}
