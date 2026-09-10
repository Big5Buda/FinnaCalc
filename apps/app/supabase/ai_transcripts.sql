-- AI transcript store — run once in the Supabase SQL editor.
--
-- One row per answer a language model gave a reader, through /api/chat or
-- /api/budget-advisor. Before this table nothing the model said was kept
-- anywhere: a reader who asked "what did FinnaCalc tell me about NVDA on the
-- 12th" could not be answered, and neither could a regulator asking the same
-- question about everyone. That is the question this table exists to answer,
-- which is why `symbols` is indexed the way it is.
--
-- A row contains the latest question (or budget-finding text), the answer
-- shown after screening, removed text and metadata. Portfolio context embedded
-- in the latest message is stored with it. The full structured budget snapshot
-- is sent to Google as model context but is not separately written here;
-- questions, findings and answers can still contain budget or identifying data.
-- A null user_id means no account association, not anonymized content.
--
-- RLS is enabled with no client policies. Only the backend service_role and
-- database administrators access this table. Routes resolve the account from
-- a verified Supabase token, never a client-supplied user id.
--
-- Account deletion removes its rows, including via the auth-user cascade.
-- Apply ai_transcript_retention.sql AFTER this file to install the hourly
-- 30-day cleanup for both signed-in and signed-out rows. Applying this table
-- script alone does not enable retention. See docs/ai-transcript-retention.md.

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
