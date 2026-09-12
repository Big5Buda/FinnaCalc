-- Expand BEFORE deploying key-aware code; do not change credentials yet.
-- Explicitly approved legacy client ID. A key change is NOT a user migration.
begin;

alter table public.snaptrade_users add column if not exists client_id text;
-- Old deployed writers omit this field and must remain in their original key.
alter table public.snaptrade_users alter column client_id set default 'FINNACALC-TEST-PKUEY';
update public.snaptrade_users set client_id = 'FINNACALC-TEST-PKUEY' where client_id is null;
alter table public.snaptrade_users alter column client_id set not null;

-- Mixed-version protection: old code can receive 404 from the wrong key.
-- Its direct DELETE (including an auth.users cascade) must retain credentials.
-- Key-aware code uses the service-only RPC below after accepted vendor deletion.
create or replace function public.guard_snaptrade_session_ownership()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.client_id is distinct from old.client_id
      or new.st_user_id is distinct from old.st_user_id
      or new.st_user_secret is distinct from old.st_user_secret
      or new.user_id is distinct from old.user_id then
      raise exception 'snaptrade_session_ownership_is_immutable';
    end if;
    return new;
  end if;
  if current_setting('finnacalc.snaptrade_session_delete', true)
    is distinct from jsonb_build_array(old.user_id, old.client_id, old.st_user_id)::text then
    raise exception 'snaptrade_session_requires_verified_owner_deletion';
  end if;
  return old;
end;
$$;
drop trigger if exists snaptrade_session_ownership_guard on public.snaptrade_users;
create trigger snaptrade_session_ownership_guard
before update or delete on public.snaptrade_users
for each row execute function public.guard_snaptrade_session_ownership();

create or replace function public.delete_snaptrade_session(
  p_user_id uuid, p_client_id text, p_st_user_id text
) returns void language plpgsql security definer set search_path = public as $$
declare
  stored public.snaptrade_users%rowtype;
  previous_guard text;
begin
  select * into stored from public.snaptrade_users where user_id = p_user_id for update;
  if not found then return; end if;
  if p_client_id is distinct from stored.client_id or p_st_user_id is distinct from stored.st_user_id then
    raise exception 'snaptrade_session_owner_changed';
  end if;
  previous_guard := current_setting('finnacalc.snaptrade_session_delete', true);
  perform set_config('finnacalc.snaptrade_session_delete',
    jsonb_build_array(p_user_id, p_client_id, p_st_user_id)::text, true);
  delete from public.snaptrade_users where user_id = p_user_id;
  perform set_config('finnacalc.snaptrade_session_delete', coalesce(previous_guard, ''), true);
end;
$$;
revoke all on function public.guard_snaptrade_session_ownership() from public, anon, authenticated;
revoke all on function public.delete_snaptrade_session(uuid, text, text) from public, anon, authenticated;
grant execute on function public.delete_snaptrade_session(uuid, text, text) to service_role;

commit;
