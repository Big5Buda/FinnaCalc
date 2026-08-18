-- Last-seen tracking, for pruning brokerage connections nobody is using.
--
-- SnapTrade bills per connected user every month whether or not anyone opens
-- the app, and brokerage connections are open to free accounts, so there is no
-- subscription lapse to hang a teardown on. Time since last use is the only
-- signal, and neither table carried a timestamp of any kind.
--
-- Bank connections are NOT pruned on this timer. They end when the
-- subscription that paid for them ends, which the app handles the moment it
-- sees the entitlement go. A Budgeting Plus subscriber who has not opened the
-- app for six weeks is still paying, and cutting their bank off would be
-- wrong. plaid_items still gets the column, for support and debugging, but
-- nothing acts on it.
--
-- Run this once in the Supabase SQL editor. Until it runs, the pruning job
-- finds the columns missing and does nothing, which is the safe direction.

alter table if exists public.snaptrade_users
    add column if not exists last_seen_at timestamptz;

-- Whether this account currently pays for investing. Stamped by the app's
-- daily ping so the pruning job can exempt subscribers: somebody paying for
-- Investing Plus or Pro keeps their brokerage however long they stay away.
-- Defaults to false, which only ever costs the operator, never the user.
alter table if exists public.snaptrade_users
    add column if not exists has_investing boolean not null default false;

alter table if exists public.plaid_items
    add column if not exists last_seen_at timestamptz;

-- Existing rows get today rather than null, so nobody who linked before this
-- shipped is treated as dormant on day one and disconnected without warning.
update public.snaptrade_users set last_seen_at = now() where last_seen_at is null;
update public.plaid_items      set last_seen_at = now() where last_seen_at is null;

create index if not exists snaptrade_users_last_seen_idx on public.snaptrade_users (last_seen_at);
create index if not exists plaid_items_last_seen_idx      on public.plaid_items (last_seen_at);
