-- MV-S11-01 / MV-S11-04 (F-01, F-19, D-016) — the invite gate becomes real before the first
-- beta invite goes out.
--
-- Until now `invite_only` was enforced by the onboarding screen alone:
--   * a signed-in visitor could skip it by inserting their own `profiles` row through the API;
--   * `redeem_invite` spent a seat every time it was called, and the wizard only remembered the
--     redemption in memory — close the tab after entering a one-seat code and the code was gone
--     while the collector still had no profile (locked out of a closed beta by their own invite);
--   * codes were matched exactly, so `tt-k7qm-2xhp` typed on a phone was "invalid";
--   * worst: `redeem_invite` logged its event with the caller as actor, and `domain_events.actor_id`
--     references `profiles` — so for a NEW collector (no profile yet, which is exactly when the
--     wizard asks for the code) every redemption failed on that foreign key. The flow only ever
--     passed its test because the test's redeemer already had a profile.
--
-- Now: `invite_redemptions` records who redeemed what (one row per collector, ever);
-- `redeem_invite` is idempotent per collector and forgiving about case / spaces; and a BEFORE
-- INSERT trigger on `profiles` refuses onboarding without a redemption while `invite_only` is on
-- for that user. Existing profiles are untouched (the gate is on INSERT only).

create table public.invite_redemptions (
  user_id     uuid primary key,
  code        text not null references public.invites(code) on update cascade on delete restrict,
  cohort      text,
  redeemed_at timestamptz not null default now()
);
create index invite_redemptions_code_idx on public.invite_redemptions (code);
create index invite_redemptions_cohort_idx on public.invite_redemptions (cohort);
alter table public.invite_redemptions enable row level security;
create policy "Users read their own invite redemption" on public.invite_redemptions for select
  using (user_id = auth.uid());
create policy "Admins read invite redemptions" on public.invite_redemptions for select
  using (public.is_admin());
revoke all on public.invite_redemptions from public, anon, authenticated;
grant select on public.invite_redemptions to authenticated;

comment on table public.invite_redemptions is
  'Who redeemed which invite (F-01). Written only by redeem_invite(); user_id is the auth user id and deliberately has no FK to profiles — the redemption happens before the profile exists.';

-- Backfill from the event log: the first invite.redeemed event of each collector whose code
-- still exists. Seats were already counted when those events were written.
insert into public.invite_redemptions (user_id, code, cohort, redeemed_at)
select distinct on (e.actor_id)
       e.actor_id, i.code, i.cohort, e.occurred_at
from public.domain_events e
join public.invites i on i.code = e.payload ->> 'code'
where e.type = 'invite.redeemed' and e.actor_id is not null
order by e.actor_id, e.occurred_at
on conflict (user_id) do nothing;

-- ---------- redeem_invite: idempotent per collector, case-insensitive ----------
create or replace function public.redeem_invite(p_code text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_invite public.invites;
  v_uid    uuid := auth.uid();
  v_code   text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
begin
  if v_uid is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;
  -- Re-entering the code they already used (tab closed mid-onboarding): fine, no seat spent —
  -- even if the code has since filled up or expired.
  if exists (select 1 from public.invite_redemptions r
              where r.user_id = v_uid and upper(r.code) = v_code) then
    return;
  end if;

  select * into v_invite from public.invites where upper(code) = v_code for update;
  if not found then
    raise exception 'Invalid invite code' using errcode = 'P0001';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'Invite code has expired' using errcode = 'P0001';
  end if;
  if v_invite.used_count >= v_invite.max_uses then
    raise exception 'Invite code already used' using errcode = 'P0001';
  end if;
  -- Already through the gate with another code: a second valid code spends nothing.
  if exists (select 1 from public.invite_redemptions r where r.user_id = v_uid) then
    return;
  end if;

  update public.invites set used_count = used_count + 1 where code = v_invite.code;
  insert into public.invite_redemptions (user_id, code, cohort)
    values (v_uid, v_invite.code, v_invite.cohort);
  -- domain_events.actor_id references profiles, and a new collector redeems BEFORE their profile
  -- exists: the old unconditional emit made every pre-onboarding redemption fail on that FK. The
  -- event is written now for an existing profile, otherwise by the profiles trigger below.
  if exists (select 1 from public.profiles p where p.id = v_uid) then
    perform public.emit_event(v_uid, 'invite.redeemed', 'invite', null,
      jsonb_build_object('code', v_invite.code, 'cohort', v_invite.cohort));
  end if;
end;
$$;

-- ---------- invite.redeemed is logged once the profile exists ----------
create or replace function public.emit_invite_redeemed_on_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_r public.invite_redemptions;
begin
  select * into v_r from public.invite_redemptions r where r.user_id = new.id;
  if found and not exists (
       select 1 from public.domain_events e where e.type = 'invite.redeemed' and e.actor_id = new.id) then
    insert into public.domain_events (actor_id, type, entity, payload, occurred_at)
      values (new.id, 'invite.redeemed', 'invite',
              jsonb_build_object('code', v_r.code, 'cohort', v_r.cohort), v_r.redeemed_at);
  end if;
  return new;
end; $$;
revoke execute on function public.emit_invite_redeemed_on_profile() from public, anon, authenticated;
drop trigger if exists profiles_emit_invite_redeemed on public.profiles;
create trigger profiles_emit_invite_redeemed
  after insert on public.profiles
  for each row execute function public.emit_invite_redeemed_on_profile();

-- ---------- onboarding needs a redeemed invite while invite_only is on ----------
create or replace function public.require_invite_for_profile() returns trigger
language plpgsql as $$
begin
  -- SECURITY INVOKER on purpose (same reasoning as guard_profile_privileged_columns): only a
  -- direct API insert — client onboarding — is gated. Migrations, seeds, psql, the service role
  -- and definer RPCs run as other roles and are never asked for a code. The collector can read
  -- their own invite_redemptions row under RLS; mv_flag_active is a definer helper.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if public.mv_flag_active('invite_only', new.id)
     and not exists (select 1 from public.invite_redemptions r where r.user_id = new.id) then
    raise exception 'invite_required' using errcode = '42501',
      hint = 'Tiny Torque is invite-only right now: redeem an invite code before onboarding.';
  end if;
  return new;
end; $$;
drop trigger if exists profiles_require_invite on public.profiles;
create trigger profiles_require_invite
  before insert on public.profiles
  for each row execute function public.require_invite_for_profile();

notify pgrst, 'reload schema';
