// F-14 (MV-S1-08): "download my data". Returns the signed-in user's own profile + every
// collection item as a JSON attachment. GET so a plain btn-secondary <a href> triggers the
// browser download — no client JS. Auth is the session cookie; RLS scopes every read to the
// caller, so there is no id in the URL and no way to fetch anyone else's data.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getProfile, buildExportPayload } from '@/domain/identity';
import { listCollectionItems } from '@/domain/garage';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const profile = await getProfile(supabase, user.id);
  if (!profile) return new NextResponse('Profile not found', { status: 404 });

  const items = await listCollectionItems(supabase, user.id);
  const payload = buildExportPayload(profile, items);
  const filename = `mini-vault-export-${profile.handle ?? user.id}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
