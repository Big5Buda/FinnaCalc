-- Annual-plan inactivity cleanup — additive migration, run once in the
-- Supabase SQL editor AFTER plaid_items.sql, snaptrade_users.sql and
-- snaptrade_key_ownership.sql. Safe to re-run.
--
-- What it adds:
--   app_activity                       one row per account: last real app use
--                                      (stamped by POST /api/session/seen,
--                                      the app's foreground ping, and by new
--                                      bank/brokerage links). Never stamped by
--                                      webhooks or background sync.
--   connection_cleanup_receipts        durable per-account record of an annual
--                                      inactivity disconnection. 'pending'
--                                      while a run holds it; 'completed' only
--                                      after vendor-confirmed removals; the
--                                      app shows a notice only for completed.
--   claim/record/finish/ack functions  compare-and-set state changes, executable
--                                      by service_role only.
--
-- Safety properties (see app/api/cron/prune-connections/route.ts):
--   * No app_activity row (or NULL) means "unknown": never eligible. The table
--     starts empty, so nobody is eligible until 60 days after the first ping
--     recorded here — no mass disconnect on first deploy.
--   * claim re-reads activity under a row lock: a user active after selection
--     is skipped, and a live lease stops overlapping cron runs.
--   * One pending receipt per account (partial unique index).
--   * RLS on with NO policies: anon/authenticated get nothing; functions are
--     revoked from public and granted to service_role only.
--   * Both tables cascade with auth.users, so account deletion removes them.

begin;

create table if not exists public.app_activity (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  annual_policy_acknowledged boolean not null default false,
  cleanup_checked_at timestamptz
);
alter table public.app_activity enable row level security;
revoke all on public.app_activity from anon, authenticated;

create table if not exists public.connection_cleanup_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  rule text not null default 'annual_inactivity_60d' check (rule = 'annual_inactivity_60d'),
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  cutoff timestamptz not null,
  claim_token uuid,
  claimed_at timestamptz,
  attempts integer not null default 0,
  banks_removed integer not null default 0 check (banks_removed >= 0),
  brokerages_removed integer not null default 0 check (brokerages_removed >= 0),
  last_error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  acknowledged_at timestamptz,
  -- A completed receipt always names at least one confirmed removal.
  constraint completed_has_removal check (status <> 'completed' or banks_removed + brokerages_removed > 0)
);
create unique index if not exists connection_cleanup_one_pending
  on public.connection_cleanup_receipts (user_id) where status = 'pending';
create index if not exists connection_cleanup_notice_idx
  on public.connection_cleanup_receipts (user_id, completed_at) where status = 'completed' and acknowledged_at is null;
alter table public.connection_cleanup_receipts enable row level security;
revoke all on public.connection_cleanup_receipts from anon, authenticated;

-- Foreground ping / new link. Never moves the timestamp backwards.
create or replace function public.touch_app_activity(p_user_id uuid,p_annual_policy boolean default false)
returns void language sql security definer set search_path = public as $$
  insert into public.app_activity (user_id, last_seen_at,annual_policy_acknowledged) values (p_user_id, now(),p_annual_policy)
  on conflict (user_id) do update set last_seen_at = greatest(public.app_activity.last_seen_at, excluded.last_seen_at),
   annual_policy_acknowledged = public.app_activity.annual_policy_acknowledged or excluded.annual_policy_acknowledged;
$$;

-- Returns (receipt_id, claim_token) when this caller may process the account
-- now, or no row when the account is active again, unknown, or leased by an
-- overlapping run. A stale pending receipt for an account that became active
-- again is closed truthfully: completed if removals were confirmed, else
-- cancelled.
create or replace function public.claim_inactive_connection_cleanup(
  p_user_id uuid, p_cutoff timestamptz, p_lease_seconds integer)
returns table (receipt_id uuid, claim_token uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_seen timestamptz; v_ack boolean;
  v_receipt public.connection_cleanup_receipts%rowtype;
  v_token uuid := gen_random_uuid();
begin
  select a.last_seen_at,a.annual_policy_acknowledged into v_seen,v_ack from public.app_activity a where a.user_id = p_user_id for update;
  select * into v_receipt from public.connection_cleanup_receipts r
    where r.user_id = p_user_id and r.status = 'pending' for update;

  if v_receipt.id is not null and v_receipt.claimed_at is not null
     and v_receipt.claimed_at > now() - make_interval(secs => p_lease_seconds) then
    return; -- another run holds the lease
  end if;

  if v_seen is null or not v_ack or v_seen > p_cutoff then
    if v_receipt.id is not null then
      update public.connection_cleanup_receipts set
        status = case when banks_removed + brokerages_removed > 0 then 'completed' else 'cancelled' end,
        completed_at = case when banks_removed + brokerages_removed > 0 then now() else null end,
        claim_token = null, claimed_at = null, last_error_code = coalesce(last_error_code, 'active_again')
      where id = v_receipt.id;
    end if;
    return;
  end if;

  if v_receipt.id is null then
    insert into public.connection_cleanup_receipts (user_id, cutoff, claim_token, claimed_at, attempts)
      values (p_user_id, p_cutoff, v_token, now(), 1)
      returning id into v_receipt.id;
  else
    update public.connection_cleanup_receipts set claim_token = v_token, claimed_at = now(),
      attempts = attempts + 1, cutoff = p_cutoff
      where id = v_receipt.id;
  end if;
  receipt_id := v_receipt.id; claim_token := v_token;
  return next;
end $$;

-- Idempotent vendor-success journal; no credentials, only generation identifiers.
create table if not exists public.connection_cleanup_removals (
 receipt_id uuid not null references public.connection_cleanup_receipts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 target_key text not null, kind text not null check(kind in ('bank','brokerage')),
 identity jsonb not null, local_deleted boolean not null default false,
 primary key(receipt_id,target_key)
);
alter table public.connection_cleanup_removals enable row level security;
revoke all on public.connection_cleanup_removals from anon, authenticated;

create or replace function public.inactive_cleanup_can_remove(p_receipt_id uuid,p_claim_token uuid)
returns boolean language sql security definer set search_path=public as $$
 select exists(select 1 from connection_cleanup_receipts r join app_activity a using(user_id)
 where r.id=p_receipt_id and r.claim_token=p_claim_token and r.status='pending'
 and r.claimed_at > now()-interval '5 minutes' and a.annual_policy_acknowledged and a.last_seen_at <= r.cutoff);
$$;
create or replace function public.connection_cleanup_in_progress(p_user_id uuid)
returns boolean language sql security definer set search_path=public as $$
 select exists(select 1 from connection_cleanup_receipts where user_id=p_user_id
 and status='pending' and claimed_at > now()-interval '5 minutes');
$$;
create or replace function public.record_inactive_connection_removal(
 p_receipt_id uuid,p_claim_token uuid,p_kind text,p_target_key text,p_identity jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_owner uuid; v_inserted integer;
begin
 if p_kind not in ('bank','brokerage') then raise exception 'invalid_removal_kind'; end if;
 select user_id into v_owner from connection_cleanup_receipts
 where id=p_receipt_id and claim_token=p_claim_token and status='pending' for update;
 if not found then return false; end if;
 insert into connection_cleanup_removals(receipt_id,user_id,target_key,kind,identity)
 values(p_receipt_id,v_owner,p_target_key,p_kind,p_identity) on conflict do nothing;
 get diagnostics v_inserted = row_count;
 if v_inserted=1 then
 update connection_cleanup_receipts set
 banks_removed=banks_removed+(case when p_kind='bank' then 1 else 0 end),
 brokerages_removed=brokerages_removed+(case when p_kind='brokerage' then 1 else 0 end)
 where id=p_receipt_id;
 end if;
 return true;
end $$;
create or replace function public.finish_inactive_connection_local(p_receipt_id uuid,p_claim_token uuid,p_target_key text)
returns void language sql security definer set search_path=public as $$
 update connection_cleanup_removals m set local_deleted=true from connection_cleanup_receipts r
 where m.receipt_id=r.id and r.id=p_receipt_id and r.claim_token=p_claim_token and m.target_key=p_target_key;
$$;
-- A concurrently re-linked bank's new credential must never be deleted.
create or replace function public.remove_cleaned_bank_item(p_user_id uuid,p_item_id text,p_token_hash text)
returns void language sql security definer set search_path=public as $$
 delete from plaid_items where user_id=p_user_id and item_id=p_item_id
 and encode(sha256(convert_to(access_token,'UTF8')),'hex')=p_token_hash;
$$;

-- Ends a run. Completed only with at least one confirmed removal; nothing
-- removed + failures keeps it pending (lease released) for a retry; nothing
-- removed and nothing failed is cancelled.
create or replace function public.finish_inactive_connection_cleanup(
  p_receipt_id uuid, p_claim_token uuid, p_failed boolean, p_error_code text)
returns text language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  update public.connection_cleanup_receipts set
    status = case when banks_removed + brokerages_removed > 0 then 'completed'
                  when p_failed then 'pending' else 'cancelled' end,
    completed_at = case when banks_removed + brokerages_removed > 0 then now() else null end,
    claim_token = null, claimed_at = null,
    last_error_code = case when p_failed then left(p_error_code, 64) else last_error_code end
  where id = p_receipt_id and claim_token = p_claim_token and status = 'pending'
  returning status into v_status;
  return v_status; -- null when the lease was lost
end $$;

-- Owner-scoped acknowledgement of completed receipts.
create or replace function public.ack_connection_cleanup_receipts(p_user_id uuid, p_ids uuid[])
returns integer language sql security definer set search_path = public as $$
  with done as (
    update public.connection_cleanup_receipts set acknowledged_at = now()
    where user_id = p_user_id and id = any(p_ids) and status = 'completed' and acknowledged_at is null
    returning 1)
  select count(*)::integer from done;
$$;

revoke all on function public.touch_app_activity(uuid,boolean) from public, anon, authenticated;
revoke all on function public.claim_inactive_connection_cleanup(uuid, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.finish_inactive_connection_cleanup(uuid, uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.ack_connection_cleanup_receipts(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.touch_app_activity(uuid,boolean) to service_role;
grant execute on function public.claim_inactive_connection_cleanup(uuid, timestamptz, integer) to service_role;
grant execute on function public.finish_inactive_connection_cleanup(uuid, uuid, boolean, text) to service_role;
grant execute on function public.ack_connection_cleanup_receipts(uuid, uuid[]) to service_role;

revoke all on function public.inactive_cleanup_can_remove(uuid,uuid) from public,anon,authenticated;
grant execute on function public.inactive_cleanup_can_remove(uuid,uuid) to service_role;
revoke all on function public.connection_cleanup_in_progress(uuid) from public,anon,authenticated;
grant execute on function public.connection_cleanup_in_progress(uuid) to service_role;
revoke all on function public.record_inactive_connection_removal(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_inactive_connection_removal(uuid,uuid,text,text,jsonb) to service_role;
revoke all on function public.finish_inactive_connection_local(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.finish_inactive_connection_local(uuid,uuid,text) to service_role;
revoke all on function public.remove_cleaned_bank_item(uuid,text,text) from public,anon,authenticated;
grant execute on function public.remove_cleaned_bank_item(uuid,text,text) to service_role;
grant all on public.app_activity,public.connection_cleanup_receipts,public.connection_cleanup_removals to service_role;

-- Expired workers with confirmed removals must still notify an owner who returned.
create or replace function public.settle_expired_connection_cleanup(p_user_id uuid default null)
returns void language sql security definer set search_path=public as $$
 update connection_cleanup_receipts r set
 status=case when banks_removed+brokerages_removed>0 then 'completed' else 'cancelled' end,
 completed_at=case when banks_removed+brokerages_removed>0 then now() else null end,
 claim_token=null,claimed_at=null
 from app_activity a where r.user_id=a.user_id and (p_user_id is null or r.user_id=p_user_id)
 and r.status='pending' and (r.claimed_at is null or r.claimed_at<=now()-interval '5 minutes')
 and (banks_removed+brokerages_removed>0 or a.last_seen_at>r.cutoff);
$$;
revoke all on function public.settle_expired_connection_cleanup(uuid) from public,anon,authenticated;
grant execute on function public.settle_expired_connection_cleanup(uuid) to service_role;

commit;
