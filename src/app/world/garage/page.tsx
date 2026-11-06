import type { Metadata } from 'next';
import GarageEditor from '@/components/world/GarageEditor';
import { loadWorldPage } from '../_data';

export const metadata: Metadata = {
  title: 'Your garage',
};

// Scene + editor (MV-W02-02/03, D-082 proposed).
export default async function WorldGaragePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { own, items, shop } = await loadWorldPage(await searchParams, { next: '/world/garage' });
  const owned = new Set(own.inventory.map((i) => i.item_id));
  const themes = shop.items.filter((i) => i.kind === 'theme' && owned.has(i.id));
  const renamePrice = shop.items.find((i) => i.sku === 'garage_rename')?.price ?? null;

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">Your garage</h1>
      <p className="page-sub">Place your public cars, pick a featured one, set who can visit.</p>
      <GarageEditor own={own} items={items} themes={themes} renamePrice={renamePrice} />
    </main>
  );
}
