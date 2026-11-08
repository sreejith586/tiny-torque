// The ONLY file in this module that talks to Supabase (D-007). Every write is a SECURITY DEFINER RPC from
// 0015_clubs_meetups (D-021 / 07 P4) except the host's descriptive edit, which is a direct update that the
// column-level grant + meetups_guard trigger keep honest. Reads go through RLS (meetup_visible). Room
// messages live in domain/messaging (the S6 thread table), not here.
import type { Client, Enums, TablesUpdate } from '@/lib/supabase/types';
import type { CollectionItemRow } from '@/domain/garage/types';
import type {
  MeetupInviteRow,
  MeetupRow,
  MeetupRsvpRow,
  MeetupShowcaseRow,
  MeetupVisibility,
} from './types';

export async function getMeetup(supabase: Client, id: string): Promise<MeetupRow | null> {
  const { data, error } = await supabase.from('meetups').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/** Scheduled or live meetups that have not ended, soonest first (RLS applies the visibility rule). */
export async function listUpcoming(supabase: Client, limit = 30): Promise<MeetupRow[]> {
  const { data, error } = await supabase
    .from('meetups')
    .select('*')
    .in('status', ['scheduled', 'live'])
    .gt('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Meetups the user hosts (any status), newest start first. */
export async function listHosted(
  supabase: Client,
  userId: string,
  limit = 30
): Promise<MeetupRow[]> {
  const { data, error } = await supabase
    .from('meetups')
    .select('*')
    .eq('host_id', userId)
    .order('starts_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** The user's own rsvp rows (newest first) — "mine" = hosted ∪ rsvp'd. */
export async function listMyRsvps(
  supabase: Client,
  userId: string,
  limit = 50
): Promise<MeetupRsvpRow[]> {
  const { data, error } = await supabase
    .from('meetup_rsvps')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listMeetupsByIds(supabase: Client, ids: string[]): Promise<MeetupRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('meetups').select('*').in('id', ids);
  if (error) throw error;
  return data ?? [];
}

export async function listRsvps(supabase: Client, meetupId: string): Promise<MeetupRsvpRow[]> {
  const { data, error } = await supabase
    .from('meetup_rsvps')
    .select('*')
    .eq('meetup_id', meetupId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Going / checked-in, not removed rsvps across several meetups (for list counts). */
export async function listGoingRsvps(
  supabase: Client,
  meetupIds: string[]
): Promise<MeetupRsvpRow[]> {
  if (meetupIds.length === 0) return [];
  const { data, error } = await supabase
    .from('meetup_rsvps')
    .select('*')
    .in('meetup_id', meetupIds)
    .in('status', ['going', 'checked_in'])
    .is('removed_at', null);
  if (error) throw error;
  return data ?? [];
}

export async function listShowcase(
  supabase: Client,
  meetupId: string
): Promise<MeetupShowcaseRow[]> {
  const { data, error } = await supabase
    .from('meetup_showcase')
    .select('*')
    .eq('meetup_id', meetupId)
    .order('user_id')
    .order('position');
  if (error) throw error;
  return data ?? [];
}

export async function listInvites(supabase: Client, meetupId: string): Promise<MeetupInviteRow[]> {
  const { data, error } = await supabase
    .from('meetup_invites')
    .select('*')
    .eq('meetup_id', meetupId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Public cars by id across owners (RLS: public + own items only) — the showcase grid's cards. */
export async function listCollectionItemsByIds(
  supabase: Client,
  ids: string[]
): Promise<CollectionItemRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('collection_items')
    .select('*')
    .in('id', ids)
    .is('deleted_at', null);
  if (error) throw error;
  return (data ?? []) as CollectionItemRow[];
}

export async function hostCap(supabase: Client, userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('meetup_host_cap', { p_user: userId });
  if (error) throw error;
  return data ?? 0;
}

// ---------- writes (RPC) ----------

export async function createMeetup(
  supabase: Client,
  args: {
    title: string;
    startsAt: string;
    endsAt: string;
    capacity: number;
    visibility: MeetupVisibility;
    theme?: string | null;
    description?: string | null;
    clubId?: string | null;
  }
): Promise<MeetupRow> {
  const { data, error } = await supabase.rpc('create_meetup', {
    p_title: args.title,
    p_starts_at: args.startsAt,
    p_ends_at: args.endsAt,
    p_capacity: args.capacity,
    p_visibility: args.visibility,
    p_theme: args.theme ?? undefined,
    p_description: args.description ?? undefined,
    p_club_id: args.clubId ?? undefined,
  });
  if (error) throw error;
  return data as unknown as MeetupRow;
}

export async function transition(supabase: Client, id: string, action: string): Promise<MeetupRow> {
  const { data, error } = await supabase.rpc('transition_meetup', { p_id: id, p_action: action });
  if (error) throw error;
  return data as unknown as MeetupRow;
}

/** Host's descriptive edit (title / theme / description / time / capacity / visibility). */
export async function updateMeetup(
  supabase: Client,
  id: string,
  patch: Pick<
    TablesUpdate<'meetups'>,
    'title' | 'theme' | 'description' | 'starts_at' | 'ends_at' | 'capacity' | 'visibility'
  >
): Promise<MeetupRow> {
  const { data, error } = await supabase
    .from('meetups')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function rsvp(
  supabase: Client,
  id: string,
  status: Extract<Enums<'meetup_rsvp_status'>, 'going' | 'declined'>
): Promise<MeetupRsvpRow> {
  const { data, error } = await supabase.rpc('rsvp_meetup', { p_id: id, p_status: status });
  if (error) throw error;
  return data as unknown as MeetupRsvpRow;
}

export async function setShowcase(
  supabase: Client,
  id: string,
  itemIds: string[]
): Promise<MeetupShowcaseRow[]> {
  const { data, error } = await supabase.rpc('set_meetup_showcase', {
    p_id: id,
    p_item_ids: itemIds,
  });
  if (error) throw error;
  return (data ?? []) as unknown as MeetupShowcaseRow[];
}

export async function invite(
  supabase: Client,
  id: string,
  handle: string
): Promise<MeetupInviteRow> {
  const { data, error } = await supabase.rpc('invite_to_meetup', { p_id: id, p_handle: handle });
  if (error) throw error;
  return data as unknown as MeetupInviteRow;
}

export async function setCohost(
  supabase: Client,
  id: string,
  handle: string,
  on: boolean
): Promise<MeetupRsvpRow> {
  const { data, error } = await supabase.rpc('set_meetup_cohost', {
    p_id: id,
    p_handle: handle,
    p_on: on,
  });
  if (error) throw error;
  return data as unknown as MeetupRsvpRow;
}

export async function moderate(
  supabase: Client,
  id: string,
  userId: string,
  action: string
): Promise<MeetupRsvpRow> {
  const { data, error } = await supabase.rpc('moderate_meetup_attendee', {
    p_id: id,
    p_user: userId,
    p_action: action,
  });
  if (error) throw error;
  return data as unknown as MeetupRsvpRow;
}
