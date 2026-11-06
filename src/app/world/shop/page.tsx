import type { Metadata } from 'next';
import WorldShop from '@/components/world/WorldShop';
import { loadWorldPage } from '../_data';

export const metadata: Metadata = {
  title: 'World shop',
};

// Shop v1 + inventory (MV-W02-05, D-083 proposed). Needs `world` and `world_shop` (economy freeze).
export default async function WorldShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const data = await loadWorldPage(await searchParams, { shop: true, next: '/world/shop' });

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">World shop</h1>
      <p className="page-sub">Levels, themes and extras — paid with your tokens.</p>
      <WorldShop own={data.own} shop={data.shop} balance={data.balance} xpLevel={data.xpLevel} />
    </main>
  );
}
