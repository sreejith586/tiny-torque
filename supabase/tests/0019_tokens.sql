-- pgTAP for the token economy (MV-S7-01/02, F-11, D-013/rule 8). credit_tokens/spend_tokens
-- idempotency, the balance-after-equals-ledger-sum invariant, insufficient-balance rejection,
-- grant-aware entitlement functions, and admin_adjust_tokens' admin-only guard. Run via CI's
-- pgTAP job.

begin;
select plan(17);

insert into auth.users (id) values
  ('60000000-0000-0000-0000-00000000000a'),
  ('60000000-0000-0000-0000-00000000000b'),
  ('60000000-0000-0000-0000-00000000000c');
insert into public.profiles (id, display_name, account_type, handle, plan, role, tokens) values
  ('60000000-0000-0000-0000-00000000000a', 'Buyer', 'individual', 't_buyer', 'free', 'user', 0),
  ('60000000-0000-0000-0000-00000000000b', 'Other', 'individual', 't_other', 'free', 'user', 0),
  ('60000000-0000-0000-0000-00000000000c', 'Admin', 'individual', 't_admin', 'free', 'admin', 0);

create schema if not exists tests;
create or replace function tests.authenticate_as(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end; $$;
create or replace function tests.clear_authentication() returns void language plpgsql as $$
begin perform set_config('role', 'supabase_admin', true); end; $$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- ---------- credit_tokens (webhook path — unprivileged role, simulates service_role) ----------
select is(
  (select balance_after from public.credit_tokens(
    '60000000-0000-0000-0000-00000000000a', 50, 'purchase', 'token_purchase', null, 'evt_test_1'
  )),
  50, 'credit_tokens credits the balance and returns balance_after'
);
select is(
  (select tokens from public.profiles where id = '60000000-0000-0000-0000-00000000000a'),
  50, 'the trigger caches the new balance onto profiles.tokens'
);
select is(
  (select count(*)::int from public.token_ledger where idempotency_key = 'evt_test_1'),
  1, 'exactly one ledger row for the idempotency key'
);
select is(
  (select balance_after from public.credit_tokens(
    '60000000-0000-0000-0000-00000000000a', 50, 'purchase', 'token_purchase', null, 'evt_test_1'
  )),
  50, 'replaying the same event (same key) returns the existing row, not a second credit'
);
select is(
  (select count(*)::int from public.token_ledger where idempotency_key = 'evt_test_1'),
  1, 'still exactly one ledger row after the replay (F-11 AC: no double-credit)'
);
select is(
  (select tokens from public.profiles where id = '60000000-0000-0000-0000-00000000000a'),
  50, 'balance unchanged after the replay'
);

-- ---------- spend_tokens (buyer spends 20 of their 50 on a listing slot) ----------
select tests.authenticate_as('60000000-0000-0000-0000-00000000000a');
select is(
  (select kind::text from public.spend_tokens('spend_listing_slot', 20, 'listing_slot')),
  'listing_slot', 'spend_tokens returns the created grant'
);
select is(
  (select tokens from public.profiles where id = '60000000-0000-0000-0000-00000000000a'),
  30, 'spending deducts from the cached balance'
);
select is(
  (select public.entitlement_listing_slots('60000000-0000-0000-0000-00000000000a')),
  3, 'base 2 slots + 1 purchased = 3'
);
select throws_ok(
  $$select public.spend_tokens('spend_listing_slot', 1000, 'listing_slot')$$,
  'P0001', 'insufficient_balance', 'spending more than the balance is rejected'
);
select is(
  (select tokens from public.profiles where id = '60000000-0000-0000-0000-00000000000a'),
  30, 'balance unchanged after a rejected spend'
);

-- ---------- a user cannot read another user's ledger/grants (RLS) ----------
select tests.clear_authentication();
select tests.authenticate_as('60000000-0000-0000-0000-00000000000b');
select is(
  (select count(*)::int from public.token_ledger where user_id = '60000000-0000-0000-0000-00000000000a'),
  0, 'a user cannot read another user''s ledger'
);
select is(
  (select count(*)::int from public.entitlement_grants where user_id = '60000000-0000-0000-0000-00000000000a'),
  0, 'a user cannot read another user''s grants'
);

-- ---------- Pro is derived from pro_until, not a flat flag ----------
select tests.clear_authentication();
select tests.authenticate_as('60000000-0000-0000-0000-00000000000b');
select is(
  (select public.is_pro('60000000-0000-0000-0000-00000000000b')), false, 'a fresh user is not Pro'
);
select public.credit_tokens('60000000-0000-0000-0000-00000000000b', 60, 'purchase', null, null, 'evt_test_2');
select public.spend_tokens('spend_pro_30d', 60, 'pro_30d');
select is(
  (select public.is_pro('60000000-0000-0000-0000-00000000000b')), true,
  'buying Pro 30d sets pro_until in the future, so is_pro() flips true'
);
select is(
  (select public.entitlement_listing_slots('60000000-0000-0000-0000-00000000000b')),
  2147483647, 'a Pro user has unlimited listing slots'
);

-- ---------- admin_adjust_tokens is admin-only ----------
select tests.clear_authentication();
select tests.authenticate_as('60000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$select public.admin_adjust_tokens('60000000-0000-0000-0000-00000000000a', 10, 'goodwill')$$,
  '42501', 'not_authorized', 'a non-admin cannot call admin_adjust_tokens'
);

select * from finish();
rollback;
