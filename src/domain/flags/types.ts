// Canonical flag catalogue — D-018 kill switches (ai_scan, offers, deal_chat, token_purchase,
// csv_import, marketplace_publish, invite_only) plus the other flags named in 04-feature-specs.md.
export const FLAG_KEYS = [
  'invite_only',
  'email_otp',
  'ai_scan',
  'ai_scan_group',
  'csv_import',
  'marketplace_publish',
  'offers',
  'deal_chat',
  'token_purchase',
  'pro_purchase',
] as const;

export type FlagKey = (typeof FLAG_KEYS)[number];

export interface FlagAudience {
  plans?: Array<'free' | 'pro'>;
  countries?: string[];
  user_ids?: string[];
  /** 0-100; percentage of users (bucketed deterministically by userId) the flag rolls out to. */
  percent?: number;
}

export interface FlagRow {
  key: string;
  enabled: boolean;
  audience: FlagAudience;
}

/** What a flag is evaluated against. Fields are optional — omitted dimensions aren't filtered on. */
export interface FlagContext {
  userId?: string;
  plan?: 'free' | 'pro';
  countryCode?: string;
}
