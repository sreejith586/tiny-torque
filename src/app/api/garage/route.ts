// Server-side garage page feed for the infinite-scroll list (MV-S2-05). Auth via session cookie;
// RLS scopes every read to the caller. Query params → GarageQuery → listGarage.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listGarage, type GarageQuery, type GarageSort } from '@/domain/garage';

const bool = (v: string | null) => (v === null ? undefined : v === 'true');

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const sp = new URL(req.url).searchParams;
  const query: GarageQuery = {
    q: sp.get('q') || undefined,
    brand: sp.get('brand') || undefined,
    rarity: sp.get('rarity') || undefined,
    condition: sp.get('condition') || undefined,
    isPublic: bool(sp.get('isPublic')),
    isFavorite: bool(sp.get('isFavorite')),
    forSale: bool(sp.get('forSale')),
    sort: (sp.get('sort') as GarageSort) || undefined,
    cursor: sp.get('cursor') || undefined,
  };

  const result = await listGarage(supabase, user.id, query);
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
