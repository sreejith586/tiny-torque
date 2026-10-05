// Public marketplace feed for the infinite-scroll browse (MV-S4-04, F-06). Anon-friendly: RLS
// exposes active listings to everyone; a signed-in caller additionally gets the country default
// from their profile and can filter to their favourites. Query params → MarketBrowseQuery.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { browseListings, type MarketBrowseQuery, type MarketSort } from '@/domain/marketplace';

const num = (v: string | null) => (v === null || v === '' ? undefined : Number(v));

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let viewerCountry: string | undefined;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('country_code')
      .eq('id', user.id)
      .maybeSingle();
    viewerCountry = profile?.country_code ?? undefined;
  }

  const sp = new URL(req.url).searchParams;
  const query: MarketBrowseQuery = {
    q: sp.get('q') || undefined,
    brand: sp.get('brand') || undefined,
    listingType: (sp.get('type') as MarketBrowseQuery['listingType']) || undefined,
    condition: sp.get('condition') || undefined,
    sellerType: sp.get('sellerType') || undefined,
    minPrice: num(sp.get('minPrice')),
    maxPrice: num(sp.get('maxPrice')),
    country: sp.get('country') || undefined, // 'all' or a code; else defaults to viewer's below
    sort: (sp.get('sort') as MarketSort) || undefined,
    cursor: sp.get('cursor') || undefined,
    // "favourites" only means something for a signed-in viewer
    favoritesOf: sp.get('favourites') === 'true' && user ? user.id : undefined,
  };

  const result = await browseListings(supabase, query, viewerCountry);
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
