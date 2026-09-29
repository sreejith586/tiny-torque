// Session refresh for src/proxy.ts (Next 16 proxy, formerly middleware).
// One of the two places allowed to import @supabase/* (D-007).
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}

/** Only called for /admin/* paths (MV-S1-06) — a second client so the common request path above
 *  doesn't pay for a profiles lookup nobody but /admin needs. */
export async function getUserRole(request: NextRequest, userId: string): Promise<string | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // Read-only lookup — refreshSession already refreshes the session's cookies.
        },
      },
    }
  );

  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  return data?.role ?? null;
}
