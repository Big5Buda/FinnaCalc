-- Subscription entitlement store — run once in the Supabase SQL editor.
--
-- One row per user, written only by the Stripe webhook and billing routes
-- with the service_role key. RLS is enabled with NO policies on purpose —
-- anon/authenticated clients get zero access; the app reads entitlements
-- through /api/billing/entitlement, never from this table directly.
--
-- A canceled subscription keeps its row (status = 'canceled') so the
-- stripe_customer_id survives for the customer portal and re-subscribing.

create table if not exists public.billing_entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  tier text not null check (tier in ('plus', 'trader', 'pro')),
  status text not null,
  billing_interval text check (billing_interval in ('monthly', 'annual')),
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.billing_entitlements enable row level security;
