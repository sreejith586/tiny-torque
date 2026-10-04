// Server-only harness detection for anon routes (/market, /market/[id]). Reads the proxy-set
// x-mv-visual header and the mv_visual cookie (reliable on Vercel) plus the ?__visual query
// (local/dev), and forces a per-request render by touching headers()/cookies(). Never honoured in
// production (harnessAllowed). Kept out of visual-fixtures.ts so that file stays client-importable.
import { cookies, headers } from 'next/headers';
import { isVisualHarness, harnessAllowed, VISUAL_COOKIE } from './visual-fixtures';

type SearchParams = Record<string, string | string[] | undefined>;

export async function isHarnessRequest(searchParams?: SearchParams): Promise<boolean> {
  if ((await headers()).get('x-mv-visual') === '1') return true;
  if (harnessAllowed() && (await cookies()).get(VISUAL_COOKIE)?.value === '1') return true;
  return isVisualHarness(searchParams);
}
