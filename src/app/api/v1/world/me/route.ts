// GET /api/v1/world/me — the caller's own garage (lazily created, 07 §2.1). 401 without a
// session, 404 while the `world` flag is off for this user (dark), 429 over the per-user limit.
import { createClient } from '@/lib/supabase/server';
import { isFlagEnabled } from '@/domain/flags';
import { getOwnGarage } from '@/domain/world';
import { apiError, enforceRateLimit, handleWorldError, json } from '../_shared';

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const limited = enforceRateLimit(req, 'world:me', user?.id ?? null);
  if (limited) return limited;
  if (!user) return apiError('unauthorized', 401);
  if (!(await isFlagEnabled(supabase, 'world', { userId: user.id })))
    return apiError('not_found', 404);

  try {
    return json(await getOwnGarage(supabase));
  } catch (e) {
    return handleWorldError(e);
  }
}
