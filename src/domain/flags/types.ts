// Canonical flag catalogue — D-018 kill switches (ai_scan, offers, deal_chat, token_purchase,
// csv_import, marketplace_publish, invite_only) plus the other flags named in 04-feature-specs.md,
// plus the eight Collectors World switches (07 §13 #11, seeded OFF by 0012_world_core).
export const CORE_FLAG_KEYS = [
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

/** `world` is the master switch; `world_shop` + `world_earn` together are the economy freeze. */
export const WORLD_FLAG_KEYS = [
  'world',
  'world_shop',
  'world_earn',
  'world_meetups',
  'world_meetups_irl',
  'world_races',
  'world_clubs',
  'world_presence',
] as const;

export const FLAG_KEYS = [...CORE_FLAG_KEYS, ...WORLD_FLAG_KEYS] as const;

export type FlagKey = (typeof FLAG_KEYS)[number];

/** Grouping for the /admin flags editor (MV-W01-09). */
export const FLAG_GROUPS: ReadonlyArray<{
  id: 'core' | 'world';
  label: string;
  keys: readonly FlagKey[];
}> = [
  { id: 'core', label: 'Core', keys: CORE_FLAG_KEYS },
  { id: 'world', label: 'Collectors World', keys: WORLD_FLAG_KEYS },
];

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

/** The editor's view of a flag — FlagRow plus the descriptive columns. */
export interface FlagAdminRow extends FlagRow {
  description: string | null;
  updated_at: string;
}

/** What a flag is evaluated against. Fields are optional — omitted dimensions aren't filtered on. */
export interface FlagContext {
  userId?: string;
  plan?: 'free' | 'pro';
  countryCode?: string;
}
