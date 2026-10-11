import { z } from 'zod';

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'Name is too short')
  .max(40, 'Name is too long');
export const accountTypeSchema = z.enum(['individual', 'shop']);

// Route segments and platform-ish words a collector's public /u/{handle} must never shadow.
export const RESERVED_HANDLES = new Set([
  'admin',
  'api',
  'app',
  'www',
  'root',
  'support',
  'help',
  'about',
  'contact',
  'login',
  'logout',
  'signin',
  'signup',
  'onboarding',
  'settings',
  'garage',
  'market',
  'marketplace',
  'offers',
  'deals',
  'profile',
  'profiles',
  'tokens',
  'token',
  'u',
  'users',
  'user',
  'invite',
  'invites',
  'null',
  'undefined',
  'anonymous',
  'system',
  'staff',
  'moderator',
  'mod',
  'official',
  'tinytorque',
  'tiny-torque',
  'minivault',
  'mini-vault',
  'collector',
  'collectors',
]);

export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9_]{3,24}$/,
    'Handle must be 3-24 characters: lowercase letters, numbers, underscores only'
  )
  .refine((h) => !RESERVED_HANDLES.has(h), { message: 'That handle is reserved' });

export const countryCodeSchema = z.string().length(2).toUpperCase();

export const profileCreateSchema = z
  .object({
    displayName: displayNameSchema,
    accountType: accountTypeSchema,
    storeName: z.string().trim().max(60).nullish(),
    location: z.string().trim().max(80).nullish(),
    mobile: z.string().trim().max(20).nullish(),
    photoMediaId: z.string().uuid().nullish(),
    handle: handleSchema.nullish(),
    countryCode: countryCodeSchema,
    city: z.string().trim().max(80).nullish(),
  })
  .refine((v) => v.accountType !== 'shop' || (v.storeName && v.storeName.length > 0), {
    message: 'Shops need a store name',
    path: ['storeName'],
  });

export const profilePatchSchema = z.object({
  displayName: displayNameSchema.optional(),
  accountType: accountTypeSchema.optional(),
  storeName: z.string().trim().max(60).nullish(),
  location: z.string().trim().max(80).nullish(),
  mobile: z.string().trim().max(20).nullish(),
  photoMediaId: z.string().uuid().nullish(),
  handle: handleSchema.optional(),
});

export type ProfileCreateParsed = z.infer<typeof profileCreateSchema>;
export type ProfilePatchParsed = z.infer<typeof profilePatchSchema>;
