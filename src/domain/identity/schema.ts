import { z } from 'zod';

export const displayNameSchema = z.string().trim().min(2, 'Name is too short').max(40, 'Name is too long');
export const accountTypeSchema = z.enum(['individual', 'shop']);

export const profileCreateSchema = z
  .object({
    displayName: displayNameSchema,
    accountType: accountTypeSchema,
    storeName: z.string().trim().max(60).nullish(),
    location: z.string().trim().max(80).nullish(),
    mobile: z.string().trim().max(20).nullish(),
    photoUrl: z.string().url().nullish(),
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
  photoUrl: z.string().url().nullish(),
});

export type ProfileCreateParsed = z.infer<typeof profileCreateSchema>;
export type ProfilePatchParsed = z.infer<typeof profilePatchSchema>;
