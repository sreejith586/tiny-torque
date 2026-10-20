// GET /api/v1/world/garages/{handle} — a garage as its owner's open-house mode allows the caller
// to see it (anon included: public garages back share links, 07 §2.2). 404 for unknown handle,
// hidden garage, or while the `world` flag is off for this caller (dark).
import { createClient } from '@/lib/supabase/server';
import { isFlagEnabled } from '@/domain/flags';
import { getGarageForVisitor, handleParamSchema } from '@/domain/world';
import { apiError, enforceRateLimit, handleWorldError, json } from '../../_shared';

export async function GET(req: Request, ctx: { params: Promise<{ handle: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const limited = enforceRateLimit(req, 'world:garage', user?.id ?? null, 120);
  if (limited) return limited;

  const handle = handleParamSchema.safeParse((await ctx.params).handle);
  if (!handle.success) return apiError('invalid_handle', 400);
  if (!(await isFlagEnabled(supabase, 'world', { userId: user?.id })))
    return apiError('not_found', 404);

  try {
    const garage = await getGarageForVisitor(supabase, handle.data, user?.id ?? null);
    return garage ? json(garage) : apiError('not_found', 404);
  } catch (e) {
    return handleWorldError(e);
  }
}
