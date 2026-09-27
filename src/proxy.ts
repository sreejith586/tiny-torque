import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Refreshes the Supabase auth session on every request (so server
// components always see a valid session) and protects the routes that
// require a signed-in user, redirecting to /login otherwise.
//
// Public (no auth required): /, /login, /onboarding, /market, static assets.
// Everything else — /garage, /profile, /offers — requires a session.

const PUBLIC_PATHS = ['/', '/login', '/onboarding', '/market', '/offers'];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  // /market and /offers are stub pages in Phase 1 (see app/market,
  // app/offers) and are intentionally left open to signed-out visitors.
  return false;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image, favicon.ico
     * - files with an extension (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
