// User-facing copy for Collectors World errors and labels (F-20/F-27). Pure — imported by both
// server actions and client views. (Rule 11's t() keys: src/lib/i18n has never existed in this
// codebase; inline strings like every sprint before.)
import type { WorldErrorCode } from '@/domain/world';

export const WORLD_ERROR_COPY: Record<WorldErrorCode, string> = {
  not_authorized: 'Sign in to use your garage.',
  garage_not_found: 'We could not find your garage. Try again.',
  insufficient_balance: 'Not enough tokens for that.',
  xp_level_too_low: 'Your collector level is not high enough for that yet.',
  max_level: 'Your garage is already at the top level.',
  item_not_found: 'That item is no longer available.',
  earned_only: 'That item can only be earned, not bought.',
  level_too_low: 'Your garage level is too low for that item.',
  already_owned: 'You already own that.',
  slot_cap_reached: 'Your level cannot hold more extra slots. Level up first.',
  invalid_name: 'Give your garage a name (up to 40 characters).',
  theme_not_owned: 'Buy that theme before applying it.',
  layout_invalid: 'That layout could not be read. Reload and try again.',
  too_many_slots: 'Too many cars for your display slots.',
  too_many_decor: 'Too many decor items for your level.',
  slot_out_of_range: 'One of those slots does not exist at your level.',
  duplicate_slot: 'Two cars are in the same slot.',
  duplicate_item: 'The same car is in two slots.',
  item_not_public: 'Only public cars can be displayed. Make it public in your garage first.',
  item_not_owned: 'You do not own that decor item.',
};

export const OPEN_MODE_LABEL = {
  public: 'Public — anyone can visit',
  followers: 'Followers only',
  invite: 'Invite only',
} as const;

export const ITEM_KIND_LABEL = {
  theme: 'Themes',
  decor: 'Decor',
  signage: 'Signage',
  tune: 'Tunes',
  trophy: 'Trophies',
  consumable: 'Extras',
} as const;
