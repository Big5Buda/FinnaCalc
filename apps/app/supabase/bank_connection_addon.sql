-- Run after apple_subscription_entitlements.sql and plaid_item_limit.sql.
--
-- Two changes, both of which are inert until an add-on product exists in App
-- Store Connect:
--   1. the entitlement mirror accepts a row that is not a plan tier, so one
--      account can hold a plan and an add-on at the same time;
--   2. the admission function takes the cap as an argument instead of
--      assuming two, so a paid third login is not refused by the database
--      after the application has already allowed it.
--
-- A tier buys features and an add-on buys capacity. Nothing that reads tiers
-- matches 'bank_addon', so an add-on row grants no feature by default; that
-- is the property to keep if anything else is ever sold this way.

alter table public.apple_subscription_entitlements
  drop constraint if exists apple_subscription_entitlements_tier_check;
alter table public.apple_subscription_entitlements
  add constraint apple_subscription_entitlements_tier_check
  check (tier in ('plus', 'trader', 'pro', 'bank_addon'));

-- The four-argument version goes, rather than being left beside the new one:
-- a default on the added argument would make a four-argument call ambiguous,
-- and the ambiguity would surface as a failed link rather than as an error
-- anybody sees at deploy time.
drop function if exists public.save_plaid_item_with_limit(uuid, text, text, text);

create or replace function public.save_plaid_item_with_limit(
  p_user_id uuid, p_item_id text, p_access_token text, p_institution text,
  p_max_items int default 2
) returns void language plpgsql security definer set search_path = public as $$
declare existing_owner uuid;
begin
  -- Never trust the argument to be generous. The caller resolves the
  -- allowance from entitlements; this floor means a bug there can refuse a
  -- connection but cannot hand out one nobody paid for.
  if p_max_items is null or p_max_items < 2 then p_max_items := 2; end if;
  perform pg_advisory_xact_lock(hashtextextended('plaid:' || p_user_id::text, 0));
  select user_id into existing_owner from plaid_items where item_id = p_item_id;
  if existing_owner is not null and existing_owner <> p_user_id then
    raise exception 'item_owned_by_another_account';
  end if;
  if existing_owner is null and (select count(*) from plaid_items where user_id = p_user_id) >= p_max_items then
    raise exception 'bank_connection_limit_reached';
  end if;
  insert into plaid_items(user_id, item_id, access_token, institution, updated_at)
  values(p_user_id, p_item_id, p_access_token, p_institution, now())
  on conflict(item_id) do update set access_token = excluded.access_token,
    institution = excluded.institution, updated_at = now()
    where plaid_items.user_id = p_user_id;
  if not found then raise exception 'item_owned_by_another_account'; end if;
end;
$$;
revoke all on function public.save_plaid_item_with_limit(uuid, text, text, text, int) from public, anon, authenticated;
grant execute on function public.save_plaid_item_with_limit(uuid, text, text, text, int) to service_role;
