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
