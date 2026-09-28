import { NextResponse, type NextRequest } from 'next/server';
import { refreshSession } from '@/lib/supabase/proxy';
import { isVisualHarness } from '@/lib/visual-fixtures';

// Next.js 16 "proxy" (formerly middleware). Refreshes the Supabase session on
// every request so Server Components always see a valid session, and guards
// the routes that require a signed-in user.
//
// Public (no auth required): /, /login, /onboarding, /market (+ listing
// detail, F-06), /u/{handle} public profiles, static assets. Everything else —
// /garage, /profile, /offers, /deals, /settings, /tokens, /admin — requires a
// session.

const PUBLIC_PATHS = new Set(['/', '/login', '/onboarding', '/market']);

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith('/market/')) return true;
  if (pathname.startsWith('/u/')) return true;
  return false;
}

export async function proxy(request: NextRequest) {
  const { response, user } = await refreshSession(request);
  const { pathname } = request.nextUrl;

  // D-041 visual-baseline harness: `?__visual=1` renders signed-in screens with fixture data and no
  // session (see src/lib/visual-fixtures.ts). Never honoured in production.
  if (isVisualHarness(request.nextUrl.searchParams)) return response;

  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\..*).*)'],
};
