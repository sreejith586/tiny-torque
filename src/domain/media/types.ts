import type { Tables } from '@/lib/supabase/types';
export type MediaRow = Tables<'media'>;

export const ITEM_MEDIA_BUCKET = 'item-media';
export const PROFILE_MEDIA_BUCKET = 'profile-media';

export interface UploadMeta {
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  sortOrder?: number;
}
