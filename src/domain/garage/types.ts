import type { CollectionItemRow } from '@/types/database';
export type { CollectionItemRow };

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
  photo?: string | null;
  photos?: string[];
  isPublic?: boolean;
  forSale?: boolean;
  openToOffers?: boolean;
  openToTrade?: boolean;
  askPrice?: number | null;
}
