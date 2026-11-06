// GET /api/v1/world/open?country=AE|all&limit=20 — the "Open garages" list (07 §2.2). Anon may
// read (public garages only; blocks apply per caller in the view); a signed-in caller defaults to
// their own country. 404 while the `world` flag is off for the caller (dark).
import { createClient } from '@/lib/supabase/server';
import { isFlagEnabled } from '@/domain/flags';
import { listOpenGarages } from '@/domain/world';
import { apiError, enforceRateLimit, handleWorldError, json } from '../_shared';

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const limited = enforceRateLimit(req, 'world:open', user?.id ?? null, 120);
  if (limited) return limited;
  if (!(await isFlagEnabled(supabase, 'world', { userId: user?.id })))
    return apiError('not_found', 404);

  let viewerCountry: string | null = null;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('country_code')
      .eq('id', user.id)
      .maybeSingle();
    viewerCountry = data?.country_code ?? null;
  }

  const sp = new URL(req.url).searchParams;
  const limitRaw = sp.get('limit');
  try {
    const garages = await listOpenGarages(
      supabase,
      {
        country: sp.get('country') ?? undefined,
        limit: limitRaw === null ? undefined : Number(limitRaw),
      },
      viewerCountry
    );
    return json({ garages });
  } catch (e) {
    if (e && typeof e === 'object' && 'issues' in e) return apiError('invalid_query', 400);
    return handleWorldError(e);
  }
}
