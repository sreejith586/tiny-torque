-- 0003_identity_rpcs — MV-S1-05, D-009/D-021, 03-data-model.md §3 (emit_event), §2.23 (invites)
-- profiles.handle_changed_at (30-day handle-change cooldown, F-01), the shared emit_event()
-- helper RPCs are supposed to use (03 §3, never wired up until now), and redeem_invite() — the
-- SECURITY DEFINER RPC identity_v2's invites RLS comment said redemption would go through
-- (D-021 pattern, same as transition_offer/spend_tokens: atomic, bypasses RLS, not raw table access).

alter table public.profiles
  add column if not exists handle_changed_at timestamptz;

-- ---------- shared event writer (03 §3: "used by RPCs; app-side writer for others") ----------
create or replace function public.emit_event(
  p_actor_id uuid,
  p_type text,
  p_entity text,
  p_entity_id uuid default null,
  p_payload jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.domain_events (actor_id, type, entity, entity_id, payload)
  values (p_actor_id, p_type, p_entity, p_entity_id, p_payload);
end;
$$;

-- ---------- redeem_invite (atomic; the only way invites.used_count changes, D-021 pattern) ----------
create or replace function public.redeem_invite(p_code text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_invite public.invites;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;

  select * into v_invite from public.invites where code = p_code for update;
  if not found then
    raise exception 'Invalid invite code' using errcode = 'P0001';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'Invite code has expired' using errcode = 'P0001';
  end if;
  if v_invite.used_count >= v_invite.max_uses then
    raise exception 'Invite code already used' using errcode = 'P0001';
  end if;

  update public.invites set used_count = used_count + 1 where code = p_code;
  perform public.emit_event(v_uid, 'invite.redeemed', 'invite', null, jsonb_build_object('code', p_code, 'cohort', v_invite.cohort));
end;
$$;
