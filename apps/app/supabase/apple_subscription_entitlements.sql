-- Run before enabling paid API enforcement. Service-role-only Apple receipt mirror.
-- A subscription's original transaction can belong to one FinnaCalc account.
-- Only Apple-checked inactive purchases lose access; empty device proofs do not.
create table if not exists public.apple_subscription_entitlements (
  environment text not null check (environment in ('Production', 'Sandbox')),
  original_transaction_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id text not null,
  product_id text not null,
  tier text not null check (tier in ('plus', 'trader', 'pro')),
  expires_at timestamptz not null,
  app_account_token uuid,
  active boolean not null default true,
  verified_at timestamptz not null default now(),
  primary key (environment, original_transaction_id)
);
alter table public.apple_subscription_entitlements enable row level security;
create index if not exists apple_subscription_user on public.apple_subscription_entitlements(user_id);

create or replace function public.sync_apple_subscription_entitlements(p_user_id uuid, p_grants jsonb, p_checked jsonb default '[]'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare item jsonb; owner_id uuid;
begin
  -- Serialize syncs for one account; unique key below arbitrates cross-account claims.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  update apple_subscription_entitlements set active = false, verified_at = now()
    where user_id = p_user_id and exists (
      select 1 from jsonb_array_elements(p_checked) as checked(value)
      where checked.value->>'environment' = apple_subscription_entitlements.environment
        and checked.value->>'original_transaction_id' = apple_subscription_entitlements.original_transaction_id
    );
  for item in select value from jsonb_array_elements(p_grants) loop
    insert into apple_subscription_entitlements (
      environment, original_transaction_id, user_id, transaction_id, product_id, tier,
      expires_at, app_account_token, active, verified_at
    ) values (
      item->>'environment', item->>'original_transaction_id', p_user_id,
      item->>'transaction_id', item->>'product_id', item->>'tier',
      (item->>'expires_at')::timestamptz, (item->>'app_account_token')::uuid, true, now()
    ) on conflict (environment, original_transaction_id) do update set
      transaction_id = excluded.transaction_id, product_id = excluded.product_id,
      tier = excluded.tier, expires_at = excluded.expires_at,
      app_account_token = excluded.app_account_token, active = true, verified_at = now()
    where apple_subscription_entitlements.user_id = p_user_id
    returning user_id into owner_id;
    if owner_id is null then raise exception 'purchase_owned_by_another_account'; end if;
  end loop;
end;
$$;
revoke all on function public.sync_apple_subscription_entitlements(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.sync_apple_subscription_entitlements(uuid, jsonb, jsonb) to service_role;
