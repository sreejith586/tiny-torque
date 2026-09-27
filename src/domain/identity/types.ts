import type { ProfileRow, AccountType } from '@/types/database';
export type { ProfileRow, AccountType };

export interface ProfileCreateInput {
  displayName: string;
  accountType: AccountType;
  storeName?: string | null;
  location?: string | null;
  mobile?: string | null;
  photoUrl?: string | null;
}

/** PATCH semantics: only keys present are written (fixes the Phase-1 upsert null-out bug). */
export type ProfilePatch = Partial<ProfileCreateInput>;
