import type { ProfileRow, AccountType, CountryRow, PublicProfileRow } from '@/types/database';
export type { ProfileRow, AccountType, CountryRow, PublicProfileRow };

export interface ProfileCreateInput {
  displayName: string;
  accountType: AccountType;
  storeName?: string | null;
  location?: string | null;
  mobile?: string | null;
  /** A `media` row id (kind 'avatar'), not a URL — stored in the `photo_url` column, D-010. */
  photoMediaId?: string | null;
  /** Editable, auto-suggested from displayName when omitted (F-01). */
  handle?: string | null;
  countryCode: string;
  city?: string | null;
}

/** PATCH semantics: only keys present are written (fixes the Phase-1 upsert null-out bug). */
export type ProfilePatch = Partial<ProfileCreateInput>;
