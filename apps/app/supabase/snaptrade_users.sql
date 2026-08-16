-- SnapTrade credential store — run once in the Supabase SQL editor.
--
-- Replaces the old client-held cookie: the SnapTrade userId/userSecret pair
-- now lives server-side, keyed to the signed-in Supabase user. RLS is enabled
-- with NO policies on purpose — anon/authenticated clients get zero access;
-- only the server's service_role key (which bypasses RLS) can read or write.

create table if not exists public.snaptrade_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  st_user_id text not null unique,
  st_user_secret text not null,
  created_at timestamptz not null default now()
);

alter table public.snaptrade_users enable row level security;
