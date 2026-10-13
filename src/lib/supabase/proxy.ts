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

/** Only called when a session exists (MV-S1-06 admin gate + MV-S5-08 suspension gate) — a second
 *  client so the common anon/public request path above doesn't pay for a profiles lookup it never
 *  needs. One query covers both checks since both only ever run together on an authed request. */
export async function getUserGuardInfo(
  request: NextRequest,
  userId: string
): Promise<{ role: string | null; suspendedUntil: string | null }> {
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

  const { data } = await supabase
    .from('profiles')
    .select('role, suspended_until')
    .eq('id', userId)
    .maybeSingle();
  return { role: data?.role ?? null, suspendedUntil: data?.suspended_until ?? null };
}
