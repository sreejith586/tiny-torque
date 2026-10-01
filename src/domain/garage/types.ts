import type { CollectionItemRow } from '@/types/database';
export type { CollectionItemRow };

/** A photo for display: a media id (resolved via /api/media/{id}) with an optional direct URL
 *  override (used by the visual harness and by just-uploaded local previews). */
export type DisplayMedia = { id: string; url?: string | null };

/** A collection item plus its photos for display. Images come from `media`, not the item row. */
export type GarageItem = CollectionItemRow & { media: DisplayMedia[] };

export interface CollectionItemInput {
  brand: string;
  model?: string | null;
  series?: string | null;
  scale?: string | null;
  variant?: string | null;
  cardType?: string | null;
  rarity?: string | null;
  condition?: string | null;
  qty?: number;
  pricePaid?: number;
  source?: string | null;
  isPublic?: boolean;
  forSale?: boolean;
  openToOffers?: boolean;
  openToTrade?: boolean;
  askPrice?: number | null;
}
