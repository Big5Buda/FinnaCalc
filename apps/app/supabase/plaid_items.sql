-- Plaid item store — run once in the Supabase SQL editor.
--
-- A Plaid access_token is long-lived and is the credential for reading one
-- linked institution. Before this table the app never kept one: every route
-- exchanged a fresh public_token, made a single call, and dropped the token on
-- the floor. That made a "bank connection" an import-once snapshot — budgets
-- silently aged and the only way to refresh anything was to walk Plaid Link
-- again. Keeping the token is what makes the connection a connection.
--
-- Same shape and same guarantees as snaptrade_users: RLS is enabled with NO
-- policies on purpose, so anon and authenticated clients get zero access and
-- only the server's service_role key (which bypasses RLS) can read or write.
-- The app reaches this exclusively through /api/plaid/*, which resolves the
-- user from a verified Supabase token and never trusts a client-supplied id.
--
-- One row per linked institution, so a user can hold several. item_id is
-- Plaid's own identifier for the link and is globally unique, which also makes
-- re-linking the same institution an upsert rather than a duplicate.

create table if not exists public.plaid_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text primary key,
  access_token text not null,
  institution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every read is "all items for this user", so index the lookup.
create index if not exists plaid_items_user_id_idx on public.plaid_items (user_id);

alter table public.plaid_items enable row level security;
