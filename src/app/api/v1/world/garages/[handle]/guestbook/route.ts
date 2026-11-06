// GET /api/v1/world/garages/{handle}/guestbook — the lines the caller may see (RLS: garage
// visibility; host-hidden lines only for the host), newest first, authors as public identities.
import { createClient } from '@/lib/supabase/server';
import { isFlagEnabled } from '@/domain/flags';
import { getGarageForVisitor, handleParamSchema, listGuestbook } from '@/domain/world';
import { apiError, enforceRateLimit, handleWorldError, json } from '../../../_shared';

export async function GET(req: Request, ctx: { params: Promise<{ handle: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const limited = enforceRateLimit(req, 'world:guestbook', user?.id ?? null, 120);
  if (limited) return limited;

  const handle = handleParamSchema.safeParse((await ctx.params).handle);
  if (!handle.success) return apiError('invalid_handle', 400);
  if (!(await isFlagEnabled(supabase, 'world', { userId: user?.id })))
    return apiError('not_found', 404);

  try {
    const garage = await getGarageForVisitor(supabase, handle.data, user?.id ?? null);
    if (!garage) return apiError('not_found', 404);
    const entries = await listGuestbook(supabase, garage.garage.user_id);
    return json({ entries });
  } catch (e) {
    return handleWorldError(e);
  }
}
