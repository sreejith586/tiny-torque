// zod boundaries for marketplace mutations (D-013). Parsed inputs feed the service; the DB
// triggers/RLS are the backstop.
import { z } from 'zod';

const optText = (max: number) => z.string().trim().max(max).nullish();

export const listingPublishSchema = z
  .object({
    sourceItemId: z.string().uuid().nullish(),
    catalogModelId: z.string().uuid().nullish(),
    brand: z.string().trim().min(1, 'Brand is required').max(60),
    model: optText(80),
    variant: optText(80),
    rarity: optText(40),
    condition: optText(40),
    listingType: z.enum(['sale', 'trade', 'both']).default('sale'),
    price: z.number().min(0).max(9_999_999).default(0),
    currency: z.string().trim().length(3).default('AED'),
    qty: z.number().int().min(1).max(9999).default(1),
    openToOffers: z.boolean().default(false),
    minOffer: z.number().min(0).max(9_999_999).nullish(),
    description: optText(2000),
  })
  .refine((v) => v.minOffer == null || v.minOffer <= v.price, {
    message: 'Minimum offer cannot exceed the price',
    path: ['minOffer'],
  });

export type ListingPublishInput = z.infer<typeof listingPublishSchema>;

export const listingUpdateSchema = z.object({
  price: z.number().min(0).max(9_999_999).optional(),
  currency: z.string().trim().length(3).optional(),
  listingType: z.enum(['sale', 'trade', 'both']).optional(),
  openToOffers: z.boolean().optional(),
  minOffer: z.number().min(0).max(9_999_999).nullish(),
  qty: z.number().int().min(1).max(9999).optional(),
  description: optText(2000),
});

export type ListingUpdateInput = z.infer<typeof listingUpdateSchema>;

export const wishlistSchema = z.object({
  brand: optText(60),
  model: optText(80),
  catalogModelId: z.string().uuid().nullish(),
  maxPrice: z.number().min(0).max(9_999_999).nullish(),
  currency: z.string().trim().length(3).nullish(),
  notify: z.boolean().default(true),
});

export type WishlistInput = z.infer<typeof wishlistSchema>;
