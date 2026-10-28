import { NextResponse, type NextRequest } from 'next/server';
import { getUserGuardInfo, refreshSession } from '@/lib/supabase/proxy';
import { isVisualHarness, harnessAllowed, VISUAL_COOKIE } from '@/lib/visual-fixtures';

// Next.js 16 "proxy" (formerly middleware). Refreshes the Supabase session on
// every request so Server Components always see a valid session, and guards
// the routes that require a signed-in user.
//
// Public (no auth required): /, /login, /onboarding, /market (+ listing
// detail, F-06), /u/{handle} public profiles, /legal/*, static assets. Everything else —
// /garage, /profile, /offers, /deals, /notifications, /settings, /tokens,
// /admin — requires a session. /admin additionally requires profiles.role =
// 'admin' (MV-S1-06) —
// the middleware redirect is the first gate, RLS on admin-only tables/RPCs
// (identity_v2's is_admin() policies) is the backstop either way.

const PUBLIC_PATHS = new Set(['/', '/login', '/onboarding', '/market']);

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith('/market/')) return true;
  if (pathname.startsWith('/u/')) return true;
  if (pathname.startsWith('/legal/')) return true;
  // /api/v1/* (MV-W01-07, ADR-05 future-client seam): JSON handlers do their own auth and answer
  // 401/404 — a redirect to /login is meaningless to a non-browser client.
  if (pathname.startsWith('/api/v1/')) return true;
  return false;
}

export async function proxy(request: NextRequest) {
  const { response, user } = await refreshSession(request);
  const { pathname } = request.nextUrl;

  // D-041 visual-baseline harness: renders screens with fixture data and no session (see
  // src/lib/visual-fixtures.ts). Never honoured in production. Triggered by the `?__visual` query
  // OR the mv_visual cookie the visual spec sets — the cookie is the reliable channel for anon
  // routes (e.g. /market), where Vercel doesn't consistently deliver the query to the Server
  // Component. We forward it as an x-mv-visual request header so pages can read it via headers().
  const harness =
    isVisualHarness(request.nextUrl.searchParams) ||
    (harnessAllowed() && request.cookies.get(VISUAL_COOKIE)?.value === '1');
  if (harness) {
    const headers = new Headers(request.headers);
    headers.set('x-mv-visual', '1');
    const res = NextResponse.next({ request: { headers } });
    // Stop Vercel's edge/CDN from serving a cached shell for the harness render (the anon /market
    // baseline was intermittently empty because of this). Belt-and-braces alongside force-dynamic.
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    res.headers.set('CDN-Cache-Control', 'no-store');
    res.headers.set('Vercel-CDN-Cache-Control', 'no-store');
    return res;
  }

  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && !isPublicPath(pathname)) {
    const { role, suspendedUntil, deletedAt } = await getUserGuardInfo(request, user.id);
    // MV-S8-05: a deleted (anonymised) account still has an auth.users row until the S9 purge job
    // removes it. Treat its session as over: clear the auth cookies and send them to /login.
    if (deletedAt) {
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('deleted', '1');
      const res = NextResponse.redirect(redirectUrl);
      for (const c of request.cookies.getAll()) {
        if (c.name.startsWith('sb-')) res.cookies.delete(c.name);
      }
      return res;
    }
    // MV-S5-08: a suspended user is blocked from every protected route, not just /admin — the
    // field only exists since S6 (messaging_trust), so this was unreachable before now.
    if (suspendedUntil && new Date(suspendedUntil) > new Date()) {
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('suspended', '1');
      return NextResponse.redirect(redirectUrl);
    }
    if (pathname.startsWith('/admin') && role !== 'admin') {
      return NextResponse.redirect(new URL('/garage', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\..*).*)'],
};
