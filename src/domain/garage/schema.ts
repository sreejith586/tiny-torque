import { z } from 'zod';

const optText = (max: number) => z.string().trim().max(max).nullish();

export const collectionItemInputSchema = z.object({
  brand: z.string().trim().min(1, 'Brand is required').max(60),
  model: optText(80),
  series: optText(80),
  scale: optText(20),
  variant: optText(80),
  cardType: optText(40),
  rarity: optText(40),
  condition: optText(40),
  qty: z.number().int().min(1).max(9999).default(1),
  pricePaid: z.number().min(0).max(9_999_999).default(0),
  source: optText(80),
  isPublic: z.boolean().default(false),
  forSale: z.boolean().default(false),
  openToOffers: z.boolean().default(false),
  openToTrade: z.boolean().default(false),
  askPrice: z.number().min(0).nullish(),
});

export type CollectionItemParsed = z.infer<typeof collectionItemInputSchema>;
