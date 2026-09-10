-- Apply after plaid_items.sql and before deploying bank connection admission.
-- Updates to existing Items remain possible; new links are capped at two.
create or replace function public.save_plaid_item_with_limit(
  p_user_id uuid, p_item_id text, p_access_token text, p_institution text
) returns void language plpgsql security definer set search_path = public as $$
declare existing_owner uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('plaid:' || p_user_id::text, 0));
  select user_id into existing_owner from plaid_items where item_id = p_item_id;
  if existing_owner is not null and existing_owner <> p_user_id then
    raise exception 'item_owned_by_another_account';
  end if;
  if existing_owner is null and (select count(*) from plaid_items where user_id = p_user_id) >= 2 then
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
revoke all on function public.save_plaid_item_with_limit(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.save_plaid_item_with_limit(uuid, text, text, text) to service_role;
