// The ONLY file in this module that talks to Supabase (D-007).
import type { Client, TablesInsert } from '@/lib/supabase/types';
import { ITEM_MEDIA_BUCKET, PROFILE_MEDIA_BUCKET, type MediaRow, type UploadMeta } from './types';

/** Upload a (already-compressed) item image to the private item-media bucket and record its row. */
export async function uploadItemMedia(
  supabase: Client,
  userId: string,
  itemId: string,
  blob: Blob,
  meta: UploadMeta = {}
): Promise<MediaRow> {
  // Key MUST start with "<uid>/" — the storage policy (0003) enforces the owner prefix.
  const path = `${userId}/${itemId}/${crypto.randomUUID()}.jpg`;
  const { error: upErr } = await supabase.storage
    .from(ITEM_MEDIA_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (upErr) throw upErr;

  const row: TablesInsert<'media'> = {
    owner_id: userId,
    kind: 'item',
    entity_id: itemId,
    bucket: ITEM_MEDIA_BUCKET,
    path,
    width: meta.width ?? null,
    height: meta.height ?? null,
    bytes: meta.bytes ?? null,
    sort_order: meta.sortOrder ?? 0,
    status: 'ready',
  };
  const { data, error } = await supabase.from('media').insert(row).select().single();
  if (error) {
    // Don't orphan the just-uploaded object if the row insert fails.
    await supabase.storage.from(ITEM_MEDIA_BUCKET).remove([path]);
    throw error;
  }
  return data;
}

/**
 * Upload a (already-compressed) avatar image to the private profile-media bucket and record its
 * row. `entity_id`/`owner_id` is the profiles row, so this must run after that row exists (unlike
 * item media, which can precede its parent — see MV-S1-04's onboarding flow).
 */
export async function uploadProfileMedia(
  supabase: Client,
  userId: string,
  blob: Blob,
  meta: UploadMeta = {},
  kind: 'avatar' | 'banner' = 'avatar'
): Promise<MediaRow> {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error: upErr } = await supabase.storage
    .from(PROFILE_MEDIA_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (upErr) throw upErr;

  const row: TablesInsert<'media'> = {
    owner_id: userId,
    kind,
    entity_id: userId,
    bucket: PROFILE_MEDIA_BUCKET,
    path,
    width: meta.width ?? null,
    height: meta.height ?? null,
    bytes: meta.bytes ?? null,
    sort_order: 0,
    status: 'ready',
  };
  const { data, error } = await supabase.from('media').insert(row).select().single();
  if (error) {
    await supabase.storage.from(PROFILE_MEDIA_BUCKET).remove([path]);
    throw error;
  }
  return data;
}

export async function listForEntity(
  supabase: Client,
  kind: MediaRow['kind'],
  entityId: string
): Promise<MediaRow[]> {
  const { data, error } = await supabase
    .from('media')
    .select('*')
    .eq('kind', kind)
    .eq('entity_id', entityId)
    .in('status', ['uploading', 'ready'])
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Signed URL for a private object. `transform` asks Storage for a resized render (Pro tier). */
export async function signUrl(
  supabase: Client,
  media: Pick<MediaRow, 'bucket' | 'path'>,
  expiresIn = 3600,
  transform?: { width?: number; height?: number; quality?: number }
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(media.bucket)
    .createSignedUrl(media.path, expiresIn, transform ? { transform } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeMedia(
  supabase: Client,
  media: Pick<MediaRow, 'id' | 'bucket' | 'path'>
): Promise<void> {
  await supabase.storage.from(media.bucket).remove([media.path]);
  const { error } = await supabase.from('media').delete().eq('id', media.id);
  if (error) throw error;
}

export async function getById(
  supabase: Client,
  id: string
): Promise<Pick<MediaRow, 'bucket' | 'path' | 'status'> | null> {
  const { data, error } = await supabase
    .from('media')
    .select('bucket, path, status')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listForEntities(
  supabase: Client,
  kind: MediaRow['kind'],
  entityIds: string[]
): Promise<MediaRow[]> {
  if (entityIds.length === 0) return [];
  const { data, error } = await supabase
    .from('media')
    .select('*')
    .eq('kind', kind)
    .in('entity_id', entityIds)
    .in('status', ['uploading', 'ready'])
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
