// Signs a private media object for <img src> use. RLS scopes the row read (owner, public-item, or
// admin), so anon can only resolve media that backs a public item. 302 → a short-lived signed URL.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMediaById, signMediaUrl } from '@/domain/media';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const media = await getMediaById(supabase, id);
  if (!media || media.status === 'removed') return new NextResponse('Not found', { status: 404 });
  try {
    const url = await signMediaUrl(supabase, media, 3600);
    return NextResponse.redirect(url, {
      status: 302,
      headers: { 'Cache-Control': 'private, max-age=1800' },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
