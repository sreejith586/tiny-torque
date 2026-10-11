// Media service — components/routes import from here, never from repo (D-007).
import * as repo from './repo';

export const uploadItemMedia = repo.uploadItemMedia;
export const uploadProfileMedia = repo.uploadProfileMedia;
export const listItemMedia = (supabase: Parameters<typeof repo.listForEntity>[0], itemId: string) =>
  repo.listForEntity(supabase, 'item', itemId);
export const listMediaForEntity = repo.listForEntity;
export const signMediaUrl = repo.signUrl;
export const removeMedia = repo.removeMedia;
export const getMediaById = repo.getById;
export const listMediaForEntities = repo.listForEntities;

export type { MediaRow, UploadMeta } from './types';
export { ITEM_MEDIA_BUCKET, PROFILE_MEDIA_BUCKET } from './types';
