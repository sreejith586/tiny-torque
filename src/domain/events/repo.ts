// The ONLY file in this module that talks to Supabase (D-007).
import type { Client, Json } from '@/lib/supabase/types';
import type { EmitEventInput } from './types';

export async function emitEvent(supabase: Client, input: EmitEventInput) {
  const { error } = await supabase.rpc('emit_event', {
    p_actor_id: input.actorId,
    p_type: input.type,
    p_entity: input.entity,
    p_entity_id: input.entityId ?? undefined,
    p_payload: (input.payload ?? {}) as Json,
  });
  if (error) throw error;
}

/** PostHog mirror (MV-S10-03, F-18): the caller's own new KPI events, each returned exactly once
 *  (a per-user cursor row advances inside the RPC). Only id / type / time — never payloads. */
export async function claimAnalyticsEvents(
  supabase: Client,
  limit = 100
): Promise<Array<{ id: number; type: string; occurred_at: string }>> {
  const { data, error } = await supabase.rpc('claim_analytics_events', { p_limit: limit });
  if (error) throw error;
  return data ?? [];
}
