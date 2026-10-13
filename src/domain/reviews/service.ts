// Reviews service (MV-S6-03, F-10). Components/routes import from here, never from repo.
// RLS is authoritative (insert only on a completed offer, by its real buyer, offer_id unique);
// rating_avg/rating_count on profiles are recomputed by a trigger in the same transaction
// (supabase/migrations/20261013000000_seller_reviews_v2.sql) — no domain_events write needed here.
import type { Client } from '@/lib/supabase/types';
import * as repo from './repo';
import { submitReviewSchema } from './schema';

export class ReviewError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = 'ReviewError';
  }
}

function toReviewError(e: unknown): never {
  const pgCode = (e as { code?: string } | null)?.code;
  if (pgCode === '23505') throw new ReviewError('already_reviewed');
  if (pgCode === '42501') throw new ReviewError('not_allowed');
  throw new ReviewError('review_failed');
}

export async function submitReview(
  supabase: Client,
  sellerId: string,
  buyerId: string,
  input: unknown
) {
  const { offerId, rating, comment } = submitReviewSchema.parse(input);
  try {
    return await repo.createReview(supabase, sellerId, buyerId, offerId, rating, comment ?? null);
  } catch (e) {
    toReviewError(e);
  }
}

export const listReviewedOfferIds = repo.listReviewedOfferIds;
export const listReviewsForSeller = repo.listReviewsForSeller;
