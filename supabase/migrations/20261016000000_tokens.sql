-- 0019_tokens — MV-S7-01/02, F-11, 03-data-model.md §2.13-2.16.
--
-- Token economy: packs (seeded reference, PLACEHOLDER pricing — D-024 still open, only the seed
-- data depends on the actual numbers), an append-only ledger (profiles.tokens is a cached balance
-- maintained by a trigger, never written directly by app code), purchases (Stripe Checkout
-- sessions, idempotent on provider_event_id), and entitlement_grants (listing_slot/scan_pack/
-- pro_30d, created by spending tokens). credit_tokens()/spend_tokens() are the only paths a
-- balance ever changes (D-021/rule 8) — both SECURITY DEFINER, both idempotent on an explicit key.
--
-- Also replaces the placeholder is_pro()/entitlement_listing_slots()/entitlement_scan_quota()
-- from 0005/0006 (hardcoded free-vs-Pro, no grants existed yet — both migrations' own comments
-- flagged this as the S7 follow-up) with grant-aware versions, and makes is_pro() check
-- pro_until too, per data-model's "pro is derived: pro_until > now()".

create type public.token_ledger_reason as enum (
  'purchase', 'spend_listing_slot', 'spend_scan_pack', 'spend_pro_30d',
  'refund', 'admin_adjust', 'promo'
);
create type public.token_purchase_provider as enum ('stripe', 'razorpay');
create type public.token_purchase_status as enum ('created', 'paid', 'failed', 'refunded');
create type public.entitlement_grant_kind as enum ('listing_slot', 'scan_pack', 'pro_30d');

-- ---------- token_packs (reference, seeded; §2.13) ----------
create table public.token_packs (
  id              uuid primary key default gen_random_uuid(),
  sku             text not null unique,
  tokens          integer not null check (tokens > 0),
  price_amount    numeric(10, 2) not null check (price_amount > 0),
  price_currency  char(3) not null default 'AED',
  stripe_price_id text,
  active          boolean not null default true,
  sort_order      integer not null default 0
);
alter table public.token_packs enable row level security;
create policy "Anyone reads active packs" on public.token_packs for select using (active);
grant select on public.token_packs to anon, authenticated;

-- PLACEHOLDER pricing (D-024 proposed, not accepted) — swap via a data-only migration once
-- Sreejith/Varun confirm real numbers; nothing else in this migration depends on these values.
insert into public.token_packs (sku, tokens, price_amount, price_currency, sort_order) values
  ('pack_small', 50, 19, 'AED', 1),
  ('pack_large', 150, 49, 'AED', 2);

-- ---------- token_ledger (append-only; §2.14) ----------
create table public.token_ledger (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  delta           integer not null check (delta <> 0),
  -- No floor check: a refund issued after the tokens it paid for were already spent legitimately
  -- takes this negative (policy: entitlements already consumed aren't clawed back, F-11). Only
  -- spend_tokens (a debit the USER initiates) must never push this below zero — enforced in that
  -- function itself, not here.
  balance_after   integer not null,
  reason          public.token_ledger_reason not null,
  ref_type        text,
  ref_id          uuid,
  idempotency_key text unique,
  created_at      timestamptz not null default now()
);
create index token_ledger_user_idx on public.token_ledger (user_id, created_at desc);
alter table public.token_ledger enable row level security;
create policy "Users read their own ledger" on public.token_ledger for select
  using (user_id = auth.uid());
grant select on public.token_ledger to authenticated;
-- No insert/update/delete policies at all, even for admin (matches reports/offers pattern) —
-- every write goes through credit_tokens()/spend_tokens() (service role or SECURITY DEFINER
-- RPCs), never a direct client write.

-- ---------- recompute_token_balance: caches profiles.tokens from the ledger ----------
create or replace function public.recompute_token_balance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set tokens = new.balance_after where id = new.user_id;
  return new;
end; $$;
create trigger recompute_token_balance after insert on public.token_ledger
  for each row execute function public.recompute_token_balance();

-- ---------- token_purchases (§2.15) ----------
create table public.token_purchases (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  pack_id             uuid not null references public.token_packs(id),
  provider            public.token_purchase_provider not null default 'stripe',
  provider_session_id text unique,
  provider_event_id   text unique,
  amount              numeric(10, 2) not null,
  currency            char(3) not null,
  status              public.token_purchase_status not null default 'created',
  ledger_id           uuid references public.token_ledger(id),
  created_at          timestamptz not null default now(),
  paid_at             timestamptz
);
create index token_purchases_user_idx on public.token_purchases (user_id, created_at desc);
alter table public.token_purchases enable row level security;
create policy "Users read their own purchases" on public.token_purchases for select
  using (user_id = auth.uid());
grant select on public.token_purchases to authenticated;
-- Inserts come from the server action that creates the Checkout session (status='created',
-- authenticated as the buyer — a user may only ever insert a purchase row for themselves);
-- updates (created->paid/failed/refunded) come only from the webhook (service role).
create policy "Users create their own pending purchase" on public.token_purchases for insert
  with check (user_id = auth.uid() and status = 'created');
grant insert on public.token_purchases to authenticated;

-- ---------- entitlement_grants (§2.16) ----------
create table public.entitlement_grants (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       public.entitlement_grant_kind not null,
  quantity   integer not null default 1 check (quantity > 0),
  expires_at timestamptz,
  ledger_id  uuid references public.token_ledger(id),
  created_at timestamptz not null default now()
);
create index entitlement_grants_user_idx on public.entitlement_grants (user_id, kind);
alter table public.entitlement_grants enable row level security;
create policy "Users read their own grants" on public.entitlement_grants for select
  using (user_id = auth.uid());
grant select on public.entitlement_grants to authenticated;

-- ---------- credit_tokens: the only way a balance ever goes up (webhook + admin_adjust) ----------
-- No grant to authenticated/anon — callable only by service_role (the webhook, connected with
-- the service key) and by other SECURITY DEFINER functions in this file that call it directly
-- (those run as the function owner, not the invoking session, so they don't need a grant here).
-- Idempotent on p_key: a replayed Stripe event (same event.id) returns the existing row instead
-- of crediting twice (F-11 AC).
create or replace function public.credit_tokens(
  p_user     uuid,
  p_delta    integer,
  p_reason   public.token_ledger_reason,
  p_ref_type text default null,
  p_ref_id   uuid default null,
  p_key      text default null
)
returns public.token_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_ledger  public.token_ledger;
  v_event_type text;
begin
  if p_delta = 0 then raise exception 'invalid_delta' using errcode = 'P0001'; end if;

  if p_key is not null then
    select * into v_ledger from public.token_ledger where idempotency_key = p_key;
    if found then return v_ledger; end if;
  end if;

  select tokens into v_balance from public.profiles where id = p_user for update;
  if not found then raise exception 'user_not_found' using errcode = 'P0002'; end if;
  -- No floor check here (see the table comment on balance_after) — spend_tokens is the only
  -- function that must reject a negative outcome, because that's a debit the user chose to make.

  insert into public.token_ledger (user_id, delta, balance_after, reason, ref_type, ref_id, idempotency_key)
    values (p_user, p_delta, v_balance + p_delta, p_reason, p_ref_type, p_ref_id, p_key)
    returning * into v_ledger;

  v_event_type := case p_reason
    when 'purchase' then 'tokens.purchased'
    when 'refund' then 'tokens.refunded'
    else 'tokens.adjusted'
  end;
  insert into public.domain_events (actor_id, type, entity, entity_id, payload)
    values (p_user, v_event_type, 'token', v_ledger.id, jsonb_build_object('reason', p_reason, 'delta', p_delta));

  return v_ledger;
end; $$;

-- Admin goodwill credits/debits (F-11: "Admin can grant tokens with a note"). p_note is stored in
-- ref_type (free text there, not an enum) since the ledger has no dedicated notes column.
create or replace function public.admin_adjust_tokens(p_user uuid, p_delta integer, p_note text default null)
returns public.token_ledger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return public.credit_tokens(p_user, p_delta, 'admin_adjust', p_note, null, null);
end; $$;
grant execute on function public.admin_adjust_tokens(uuid, integer, text) to authenticated;

-- ---------- spend_tokens: the only way tokens leave a balance (D-021/rule 8) ----------
-- Atomic: locks the profile row, checks balance, inserts the ledger row (balance_after computed
-- here, never trusted from the caller) and the matching entitlement grant in one transaction.
-- Pro is a side effect, not just a grant row: buying pro_30d also extends profiles.pro_until,
-- since that's the column is_pro()/public_profiles already key off (data-model "pro is derived:
-- pro_until > now()") — a grants-table-only Pro check would be a second, divergent source of truth.
create or replace function public.spend_tokens(
  p_reason     public.token_ledger_reason,
  p_cost       integer,
  p_grant_kind public.entitlement_grant_kind,
  p_quantity   integer default 1,
  p_expires_at timestamptz default null,
  p_ref_type   text default null,
  p_ref_id     uuid default null,
  p_key        text default null
)
returns public.entitlement_grants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_balance integer;
  v_ledger  public.token_ledger;
  v_grant   public.entitlement_grants;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_cost <= 0 then raise exception 'invalid_cost' using errcode = 'P0001'; end if;

  if p_key is not null then
    select * into v_ledger from public.token_ledger where idempotency_key = p_key;
    if found then
      select * into v_grant from public.entitlement_grants where ledger_id = v_ledger.id;
      if found then return v_grant; end if;
    end if;
  end if;

  select tokens into v_balance from public.profiles where id = v_uid for update;
  if v_balance < p_cost then raise exception 'insufficient_balance' using errcode = 'P0001'; end if;

  insert into public.token_ledger (user_id, delta, balance_after, reason, ref_type, ref_id, idempotency_key)
    values (v_uid, -p_cost, v_balance - p_cost, p_reason, p_ref_type, p_ref_id, p_key)
    returning * into v_ledger;

  insert into public.entitlement_grants (user_id, kind, quantity, expires_at, ledger_id)
    values (v_uid, p_grant_kind, p_quantity, p_expires_at, v_ledger.id)
    returning * into v_grant;

  if p_grant_kind = 'pro_30d' then
    update public.profiles
      set pro_until = greatest(coalesce(pro_until, now()), now()) + (p_quantity * interval '30 days')
      where id = v_uid;
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
      values (v_uid, 'pro.activated', 'profile', v_uid, jsonb_build_object('days', p_quantity * 30));
  end if;

  insert into public.domain_events (actor_id, type, entity, entity_id, payload)
    values (v_uid, 'tokens.spent', 'token', v_ledger.id, jsonb_build_object('reason', p_reason, 'cost', p_cost));

  return v_grant;
end; $$;
grant execute on function public.spend_tokens(
  public.token_ledger_reason, integer, public.entitlement_grant_kind, integer, timestamptz, text, uuid, text
) to authenticated;

-- ---------- entitlement functions: replace 0005/0006 placeholders with grant-aware versions ----------
-- Both migrations' own comments flagged these as PLACEHOLDER pending this exact follow-up.
create or replace function public.is_pro(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select plan = 'pro' or (pro_until is not null and pro_until > now())
    from public.profiles where id = p_user
  ), false);
$$;

create or replace function public.entitlement_listing_slots(p_user uuid)
returns integer language sql stable security definer set search_path = public as $$
  select case when public.is_pro(p_user) then 2147483647 else
    2 + coalesce((
      select sum(quantity)::integer from public.entitlement_grants
      where user_id = p_user and kind = 'listing_slot' and (expires_at is null or expires_at > now())
    ), 0)
  end;
$$;

-- Remaining scans = base-plan limit + admin bonus + purchased scan-pack grants (+25 each, 30-day
-- expiry) - `done` jobs in the last 30 days. Base limits (free 10 / pro 100) are the same
-- PLACEHOLDER numbers 0005 already used (D-024).
create or replace function public.entitlement_scan_quota(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    0,
    (case when public.is_pro(p_user) then 100 else 10 end)
    + coalesce((select scan_quota_bonus from public.profiles where id = p_user), 0)
    + coalesce((
        select sum(quantity)::integer * 25 from public.entitlement_grants
        where user_id = p_user and kind = 'scan_pack' and (expires_at is null or expires_at > now())
      ), 0)
    - (
        select count(*)
        from public.ai_scan_jobs
        where user_id = p_user and status = 'done' and created_at > now() - interval '30 days'
      )
  )::integer;
$$;

notify pgrst, 'reload schema';
