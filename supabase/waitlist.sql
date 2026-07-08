-- Pre-launch waitlist store — run once in the Supabase SQL editor.
--
-- Emails are captured by the marketing landing page (POST /api/waitlist). Like
-- snaptrade_users, RLS is enabled with NO policies on purpose: anon/authenticated
-- clients get zero access. Only the server's service_role key (which bypasses RLS,
-- used by /api/waitlist) can insert rows or read the signup count.

create table if not exists public.waitlist (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique,
  referral_source text,
  created_at      timestamptz not null default now()
);

alter table public.waitlist enable row level security;
