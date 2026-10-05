import type { Tables, Enums } from '@/lib/supabase/types';

export type OfferRow = Tables<'offers'>;
export type OfferStatus = Enums<'offer_status'>;
export type OfferType = Enums<'offer_type'>;
export type NotificationRow = Tables<'notifications'>;
