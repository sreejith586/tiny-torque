// zod at the boundary (D-013) for everything a client can send the meetups service. Limits mirror the
// CHECK constraints of 0015_clubs_meetups so a bad form fails here with field copy, not in the DB.
import { z } from 'zod';
import { MAX_DURATION_MINUTES, MEETUP_REACTIONS, MEETUP_VISIBILITIES } from './types';

export const meetupIdSchema = z.string().uuid();
export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^@?[a-z0-9_]{3,24}$/, 'Enter a collector handle')
  .transform((h) => h.replace(/^@/, ''));

const isoInstant = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Pick a date and time');

export const createMeetupSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Give it a title (3–80 characters)')
      .max(80, 'Title is too long'),
    theme: z.string().trim().max(60, 'Theme is too long').optional().or(z.literal('')),
    description: z
      .string()
      .trim()
      .max(1000, 'Description is too long')
      .optional()
      .or(z.literal('')),
    startsAt: isoInstant,
    /** 30 min … 6 h, in 15-min steps as the form offers them. */
    durationMinutes: z.number().int().min(30, 'At least 30 minutes').max(MAX_DURATION_MINUTES),
    capacity: z.number().int().min(2, 'At least 2 seats').max(500),
    visibility: z.enum(MEETUP_VISIBILITIES),
    clubId: z.string().uuid().nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (Date.parse(v.startsAt) <= Date.now()) {
      ctx.addIssue({ code: 'custom', path: ['startsAt'], message: 'Start must be in the future' });
    }
    // a club id with another visibility = "hosted by the club" (staff only, checked by the RPC)
    if (v.visibility === 'club' && !v.clubId) {
      ctx.addIssue({ code: 'custom', path: ['clubId'], message: 'Pick a club' });
    }
  });
export type CreateMeetupInput = z.infer<typeof createMeetupSchema>;

/** Host edits after creation: the columns the 0015 column-level grant allows. */
export const updateMeetupSchema = z
  .object({
    title: z.string().trim().min(3).max(80).optional(),
    theme: z.string().trim().max(60).nullable().optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    startsAt: isoInstant.optional(),
    durationMinutes: z.number().int().min(30).max(MAX_DURATION_MINUTES).optional(),
    capacity: z.number().int().min(2).max(500).optional(),
    visibility: z.enum(MEETUP_VISIBILITIES).optional(),
  })
  .strict();
export type UpdateMeetupInput = z.infer<typeof updateMeetupSchema>;

export const transitionActionSchema = z.enum(['schedule', 'start', 'end', 'cancel']);
export const rsvpStatusSchema = z.enum(['going', 'declined']);
export const showcaseSchema = z.array(z.string().uuid()).max(5);
export const moderateActionSchema = z.enum(['mute', 'unmute', 'kick']);

export const roomMessageSchema = z.object({
  meetupId: meetupIdSchema,
  body: z.string().trim().min(1, 'Type a message').max(2000, 'Keep it under 2000 characters'),
});
export const roomReactionSchema = z.object({
  meetupId: meetupIdSchema,
  reaction: z.enum(MEETUP_REACTIONS),
});
