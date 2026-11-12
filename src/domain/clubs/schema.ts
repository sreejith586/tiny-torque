// zod at the boundary (D-013) for everything a client can send the clubs service. Limits mirror the
// CHECK constraints of 0015 / 0015b so a bad form fails here with field copy, not in the DB.
import { z } from 'zod';
import { MAX_DURATION_MINUTES, MEETUP_VISIBILITIES } from '@/domain/meetups';
import { CLUB_JOIN_MODES, CLUB_NIGHT_CADENCES, CLUB_ROLES } from './types';

export const clubIdSchema = z.string().uuid();
export const userIdSchema = z.string().uuid();

export const clubSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,24}$/, 'Use 3–24 letters, numbers or underscores');

export const clubHandleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^@?[a-z0-9_]{3,24}$/, 'Enter a collector handle')
  .transform((h) => h.replace(/^@/, ''));

const name = z
  .string()
  .trim()
  .min(2, 'Give it a name (2–60 characters)')
  .max(60, 'Name is too long');
const description = z
  .string()
  .trim()
  .max(500, 'Description is too long')
  .optional()
  .or(z.literal(''));
const countryCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'Pick a country')
  .optional()
  .or(z.literal(''));

export const createClubSchema = z.object({
  slug: clubSlugSchema,
  name,
  joinMode: z.enum(CLUB_JOIN_MODES),
  description,
  countryCode,
});
export type CreateClubInput = z.infer<typeof createClubSchema>;

export const updateClubSchema = z.object({
  name,
  joinMode: z.enum(CLUB_JOIN_MODES),
  description,
  countryCode,
});
export type UpdateClubInput = z.infer<typeof updateClubSchema>;

export const memberRoleSchema = z.enum(CLUB_ROLES);
export const moderateMemberActionSchema = z.enum(['remove', 'ban', 'unban']);

const isoInstant = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Pick a date and time');

export const clubNightSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Give it a title (3–80 characters)')
      .max(80, 'Title is too long'),
    theme: z.string().trim().max(60, 'Theme is too long').optional().or(z.literal('')),
    cadence: z.enum(CLUB_NIGHT_CADENCES),
    firstStart: isoInstant,
    durationMinutes: z.number().int().min(30, 'At least 30 minutes').max(MAX_DURATION_MINUTES),
    capacity: z.number().int().min(2, 'At least 2 seats').max(500),
    visibility: z.enum(MEETUP_VISIBILITIES),
  })
  .superRefine((v, ctx) => {
    if (Date.parse(v.firstStart) <= Date.now()) {
      ctx.addIssue({
        code: 'custom',
        path: ['firstStart'],
        message: 'Start must be in the future',
      });
    }
  });
export type ClubNightInput = z.infer<typeof clubNightSchema>;
