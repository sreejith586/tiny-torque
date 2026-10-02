// zod boundaries for deal mutations (D-013).
import { z } from 'zod';

export const cashOfferSchema = z.object({
  listingId: z.string().uuid(),
  amount: z.number().positive().max(9_999_999),
  message: z.string().trim().max(500).nullish(),
});
export type CashOfferInput = z.infer<typeof cashOfferSchema>;

export const tradeOfferSchema = z.object({
  listingId: z.string().uuid(),
  tradeItemIds: z.array(z.string().uuid()).min(1, 'Pick 1-3 items').max(3, 'Pick 1-3 items'),
  cashTopUp: z.number().min(0).max(9_999_999).nullish(),
  message: z.string().trim().max(500).nullish(),
});
export type TradeOfferInput = z.infer<typeof tradeOfferSchema>;
