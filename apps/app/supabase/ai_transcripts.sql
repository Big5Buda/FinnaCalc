-- AI transcript store — run once in the Supabase SQL editor.
--
-- One row per answer a language model gave a reader, through /api/chat or
-- /api/budget-advisor. Before this table nothing the model said was kept
-- anywhere: a reader who asked "what did FinnaCalc tell me about NVDA on the
-- 12th" could not be answered, and neither could a regulator asking the same
-- question about everyone. That is the question this table exists to answer,
-- which is why `symbols` is indexed the way it is.
--
-- What a row holds. The reader's latest message as it reached the server —
-- including any context the app attached to it, such as the ticker list and
-- weights the Portfolio Analysis chat sends — and the answer AS SHOWN, after
-- the output screen. Anything the screen removed is kept alongside, with the
-- rule that caught it, so the record shows both what the model produced and
-- what the reader saw. The budget snapshot is deliberately NOT stored: the
-- privacy policy says a reader's budget lives on their device, and this table
-- keeps that true.
--
-- user_id is null for signed-out use. FinnaBot sits on the signed-out Home
-- screen and quick budget analysis needs no session, so those rows exist but
-- cannot be linked to a person; they serve review of the assistant, not the
-- per-reader question above.
--
-- Same shape and same guarantees as plaid_items and snaptrade_users: RLS is
-- enabled with NO policies on purpose, so anon and authenticated clients get
-- zero access and only the server's service_role key can read or write. The
-- app reaches this exclusively through the two routes, which resolve the user
-- from a verified Supabase token and never trust a client-supplied id.
--
-- Deletion. Rows cascade with the auth user, and /api/account/delete also
-- removes them explicitly first, for the same reason it does with Plaid rows.
-- There is no automatic expiry: how long these are kept is a policy decision
-- recorded in the privacy policy, not a constant hidden here.

create table if not exists public.ai_transcripts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete cascade,
  route text not null check (route in ('chat', 'budget-advisor', 'budget-fixes')),
  -- Which screen the conversation lives on, when the route can tell.
  surface text check (surface in ('finnabot', 'portfolio_chat', 'budget_analysis')),
  -- How many messages the client sent with this turn. Rows are not linked
  -- into conversations, so this is the only way to see that a row was a
  -- follow-up rather than an opening question.
  turn_count integer not null default 1,
  question text not null,
  answer text not null,
  -- [{ "sentence": "...", "rule": "..." }] — what the output screen removed.
  removed jsonb not null default '[]'::jsonb,
  -- Ticker-shaped tokens seen in the question or the answer, upper-cased.
  symbols text[] not null default '{}',
  model text not null,
  finish_reason text
);

-- The per-reader question: everything this user was told, newest first.
create index if not exists ai_transcripts_user_created_idx
  on public.ai_transcripts (user_id, created_at desc);

-- The per-security question: every answer that mentioned a given ticker.
create index if not exists ai_transcripts_symbols_idx
  on public.ai_transcripts using gin (symbols);

alter table public.ai_transcripts enable row level security;
