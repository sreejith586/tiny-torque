// The ONLY file in this module that talks to Supabase (D-007). Every write is a SECURITY DEFINER RPC
// from 0015b_world_best_in_show_clubs (D-021 / 07 P4) — clubs and club_members have no write policy.
// Reads go through RLS: clubs are public, a roster is readable by its active members (and by anyone
// signed in when the club is open), the feed and the member counts through their definer functions.
import type { Client } from '@/lib/supabase/types';
import type { CollectionItemRow } from '@/domain/garage/types';
import type { MeetupRow, MeetupVisibility } from '@/domain/meetups';
import type { ClubJoinMode, ClubMemberRow, ClubNightRow, ClubRole, ClubRow } from './types';

export async function getClubBySlug(supabase: Client, slug: string): Promise<ClubRow | null> {
  const { data, error } = await supabase.from('clubs').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/** Newest clubs first (clubs are public-read). */
export async function listClubs(supabase: Client, limit = 50): Promise<ClubRow[]> {
  const { data, error } = await supabase
    .from('clubs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listClubsByIds(supabase: Client, ids: string[]): Promise<ClubRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('clubs').select('*').in('id', ids);
  if (error) throw error;
  return data ?? [];
}

/** The user's own rows across clubs (active, pending or banned). */
export async function listMyMemberships(
  supabase: Client,
  userId: string
): Promise<ClubMemberRow[]> {
  const { data, error } = await supabase.from('club_members').select('*').eq('user_id', userId);
  if (error) throw error;
  return data ?? [];
}

/** Whatever of the roster RLS lets the caller read (everything for members, active rows of an open
 *  club for anyone signed in, only the caller's own row otherwise). */
export async function listMembers(supabase: Client, clubId: string): Promise<ClubMemberRow[]> {
  const { data, error } = await supabase
    .from('club_members')
    .select('*')
    .eq('club_id', clubId)
    .order('joined_at', { ascending: true })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

export async function memberCounts(
  supabase: Client,
  clubIds: string[]
): Promise<Map<string, number>> {
  if (clubIds.length === 0) return new Map();
  const { data, error } = await supabase.rpc('club_member_counts', { p_clubs: clubIds });
  if (error) throw error;
  return new Map((data ?? []).map((r) => [r.club_id, r.members]));
}

export interface FeedRow {
  event_id: number;
  type: string;
  actor_id: string | null;
  payload: unknown;
  occurred_at: string;
}

export async function feed(supabase: Client, clubId: string, limit = 20): Promise<FeedRow[]> {
  const { data, error } = await supabase.rpc('club_feed', { p_club: clubId, p_limit: limit });
  if (error) throw error;
  return (data ?? []) as FeedRow[];
}

/** Club meetups the caller may see that have not ended (drafts only reach their host, via RLS). */
export async function listClubMeetups(supabase: Client, clubId: string): Promise<MeetupRow[]> {
  const { data, error } = await supabase
    .from('meetups')
    .select('*')
    .eq('club_id', clubId)
    .in('status', ['draft', 'scheduled', 'live'])
    .gt('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function getNight(supabase: Client, clubId: string): Promise<ClubNightRow | null> {
  const { data, error } = await supabase
    .from('club_night_templates')
    .select('*')
    .eq('club_id', clubId)
    .eq('active', true)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/** Members' featured cars: the garages RLS lets the caller see, then the cars (public + own only). */
export async function listFeaturedItemIds(
  supabase: Client,
  userIds: string[]
): Promise<{ userId: string; itemId: string }[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase
    .from('world_garages')
    .select('user_id, featured_item_id')
    .in('user_id', userIds)
    .not('featured_item_id', 'is', null);
  if (error) throw error;
  return (data ?? []).flatMap((g) =>
    g.featured_item_id ? [{ userId: g.user_id, itemId: g.featured_item_id }] : []
  );
}

export async function listCollectionItemsByIds(
  supabase: Client,
  ids: string[]
): Promise<CollectionItemRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('collection_items')
    .select('*')
    .in('id', ids)
    .eq('is_public', true)
    .is('deleted_at', null);
  if (error) throw error;
  return (data ?? []) as CollectionItemRow[];
}

/** NULL when the caller may host / own a club, otherwise the reason (world_host_ineligible_reason). */
export async function hostIneligibleReason(supabase: Client): Promise<string | null> {
  const { data, error } = await supabase.rpc('world_host_ineligible_reason');
  if (error) throw error;
  return data ?? null;
}

// ---------- writes (RPC) ----------

export async function createClub(
  supabase: Client,
  args: {
    slug: string;
    name: string;
    joinMode: ClubJoinMode;
    description?: string | null;
    countryCode?: string | null;
  }
): Promise<ClubRow> {
  const { data, error } = await supabase.rpc('create_club', {
    p_slug: args.slug,
    p_name: args.name,
    p_join_mode: args.joinMode,
    p_description: args.description ?? undefined,
    p_country: args.countryCode ?? undefined,
  });
  if (error) throw error;
  return data as unknown as ClubRow;
}

export async function updateClub(
  supabase: Client,
  clubId: string,
  args: {
    name: string;
    joinMode: ClubJoinMode;
    description?: string | null;
    countryCode?: string | null;
  }
): Promise<ClubRow> {
  const { data, error } = await supabase.rpc('update_club', {
    p_club: clubId,
    p_name: args.name,
    p_join_mode: args.joinMode,
    p_description: args.description ?? undefined,
    p_country: args.countryCode ?? undefined,
  });
  if (error) throw error;
  return data as unknown as ClubRow;
}

export async function join(supabase: Client, clubId: string): Promise<ClubMemberRow> {
  const { data, error } = await supabase.rpc('join_club', { p_club: clubId });
  if (error) throw error;
  return data as unknown as ClubMemberRow;
}

export async function leave(supabase: Client, clubId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_club', { p_club: clubId });
  if (error) throw error;
}

export async function invite(
  supabase: Client,
  clubId: string,
  handle: string
): Promise<ClubMemberRow> {
  const { data, error } = await supabase.rpc('invite_to_club', {
    p_club: clubId,
    p_handle: handle,
  });
  if (error) throw error;
  return data as unknown as ClubMemberRow;
}

export async function decideApplication(
  supabase: Client,
  clubId: string,
  userId: string,
  approve: boolean
): Promise<void> {
  const { error } = await supabase.rpc('decide_club_application', {
    p_club: clubId,
    p_user: userId,
    p_approve: approve,
  });
  if (error) throw error;
}

export async function setRole(
  supabase: Client,
  clubId: string,
  userId: string,
  role: ClubRole
): Promise<ClubMemberRow> {
  const { data, error } = await supabase.rpc('set_club_member_role', {
    p_club: clubId,
    p_user: userId,
    p_role: role,
  });
  if (error) throw error;
  return data as unknown as ClubMemberRow;
}

export async function moderate(
  supabase: Client,
  clubId: string,
  userId: string,
  action: string
): Promise<void> {
  const { error } = await supabase.rpc('moderate_club_member', {
    p_club: clubId,
    p_user: userId,
    p_action: action,
  });
  if (error) throw error;
}

export async function setNight(
  supabase: Client,
  clubId: string,
  args: {
    title: string;
    cadence: string;
    firstStart: string;
    durationMinutes: number;
    capacity: number;
    visibility: MeetupVisibility;
    theme?: string | null;
  }
): Promise<ClubNightRow> {
  const { data, error } = await supabase.rpc('set_club_night', {
    p_club: clubId,
    p_title: args.title,
    p_cadence: args.cadence,
    p_first_start: args.firstStart,
    p_duration: args.durationMinutes,
    p_capacity: args.capacity,
    p_visibility: args.visibility,
    p_theme: args.theme ?? undefined,
  });
  if (error) throw error;
  return data as unknown as ClubNightRow;
}

export async function stopNight(supabase: Client, clubId: string): Promise<void> {
  const { error } = await supabase.rpc('stop_club_night', { p_club: clubId });
  if (error) throw error;
}
