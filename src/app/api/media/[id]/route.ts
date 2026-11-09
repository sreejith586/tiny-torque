// Signs a private media object for <img src> use. RLS scopes the row read (owner, public-item, or
// admin), so anon can only resolve media that backs a public item. 302 → a short-lived signed URL.
// `?w=<MEDIA_WIDTHS>` (MV-S9-03, F-17 "next/image with Supabase transforms") asks Storage for a
// resized render instead of the ≤1600 px original — a garage grid of 240 px thumbnails stops
// pulling 400 KB per card. Only the listed widths are honoured so the render cache stays warm.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMediaById, signMediaUrl } from '@/domain/media';
import { MEDIA_WIDTHS, type MediaWidth } from '@/components/MediaImage';

function renderWidth(req: Request): MediaWidth | undefined {
  const w = Number(new URL(req.url).searchParams.get('w'));
  return (MEDIA_WIDTHS as readonly number[]).includes(w) ? (w as MediaWidth) : undefined;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const media = await getMediaById(supabase, id);
  if (!media || media.status === 'removed') return new NextResponse('Not found', { status: 404 });
  try {
    const width = renderWidth(req);
    const url = await signMediaUrl(
      supabase,
      media,
      3600,
      width ? { width, quality: 75 } : undefined
    );
    return NextResponse.redirect(url, {
      status: 302,
      headers: { 'Cache-Control': 'private, max-age=1800' },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
