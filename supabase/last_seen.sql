-- Last-seen tracking, for pruning connections nobody is using.
--
-- Plaid bills per linked Item and SnapTrade per connected user, every month,
-- whether or not anyone opens the app. An account that goes quiet is a bill
-- with nothing behind it, and there was no way to notice: neither table
-- carried a timestamp of any kind.
--
-- Run this once in the Supabase SQL editor. Until it runs, the pruning job
-- finds the column missing and does nothing, which is the safe direction.

alter table if exists public.snaptrade_users
    add column if not exists last_seen_at timestamptz;

alter table if exists public.plaid_items
    add column if not exists last_seen_at timestamptz;

-- Existing rows get today rather than null, so nobody who linked before this
-- shipped is treated as dormant on day one and disconnected without warning.
update public.snaptrade_users set last_seen_at = now() where last_seen_at is null;
update public.plaid_items      set last_seen_at = now() where last_seen_at is null;

create index if not exists snaptrade_users_last_seen_idx on public.snaptrade_users (last_seen_at);
create index if not exists plaid_items_last_seen_idx      on public.plaid_items (last_seen_at);
