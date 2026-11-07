-- VERSION 4 PREPARED ONLY (dollar/notional reviews). Root review + transactional
-- preflight required. Upgrades an existing VERSION 3 schema in place; never
-- resets owner generations, never deletes rows, never rewrites stored terms or
-- results. Only rows still in 'reviewing' (unsubmitted, ≤4 min TTL) are
-- invalidated. submitting/unknown/complete/resolved/invalidated are untouched.
-- Version 4 is advertised LAST, after every object below is installed.
begin;

-- 0. Refuse anything other than an exact V3 starting point.
do $$
begin
 if to_regprocedure('public.snaptrade_order_review_storage_version()') is null
  or public.snaptrade_order_review_storage_version() is distinct from 3 then
  raise exception 'snaptrade order reviews: expected storage version 3';
 end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='snaptrade_order_reviews'
  and column_name in ('amount_mode','notional_value','estimate_units','amount_verification')) then
  raise exception 'snaptrade order reviews: V4 columns already present; inspect state first';
 end if;
end $$;

-- Block concurrent create/consume/resolve/finish for the duration.
lock table public.snaptrade_order_review_owners, public.snaptrade_order_reviews in access exclusive mode;

-- 1. Columns. Existing rows are share reviews (V3 rejected any notional).
alter table public.snaptrade_order_reviews
 add column amount_mode text, add column notional_value numeric(12,2),
 add column estimate_units numeric, add column amount_verification text;
update public.snaptrade_order_reviews set amount_mode='shares' where amount_mode is null;
alter table public.snaptrade_order_reviews alter column amount_mode set not null;

-- 2. Unsubmitted reviews cannot be confirmed across the schema change.
update public.snaptrade_order_reviews set state='invalidated' where state='reviewing';

-- 3. Null-safe canonical amount validity. Every branch is coalesced to false,
-- so a missing key/NULL can never make the CHECK pass by evaluating to NULL.
-- Shares: legacy (no amountMode/notionalValue keys) and canonical V4 shares.
-- Dollars: canonical 2dp string 1.00–10000.00 equal to notional_value, units
-- JSON null, Market/Day, price/stop JSON null, checked trade id, request_bound.
create or replace function public.snaptrade_order_review_amount_valid(
 p_mode text,p_notional numeric,p_estimate numeric,p_verification text,p_terms jsonb,p_trade text)
returns boolean language plpgsql immutable set search_path=pg_catalog,pg_temp as $$
begin
 if p_terms is null or jsonb_typeof(p_terms) is distinct from 'object' then return false; end if;
 if p_mode='shares' then
  if jsonb_typeof(p_terms->'units') is distinct from 'number' then return false; end if;
  return coalesce(p_notional is null and p_estimate is null and p_verification is null
   and (not (p_terms ? 'amountMode') or p_terms->'amountMode'='"shares"'::jsonb)
   and (not (p_terms ? 'notionalValue') or p_terms->'notionalValue'='null'::jsonb)
   and (p_terms->>'units')::numeric > 0, false);
 elsif p_mode='dollars' then
  if p_terms->'amountMode' is distinct from '"dollars"'::jsonb
   or jsonb_typeof(p_terms->'notionalValue') is distinct from 'string'
   or (p_terms->>'notionalValue') !~ '^(0|[1-9][0-9]{0,6})\.[0-9]{2}$' then return false; end if;
  return coalesce((p_terms->>'notionalValue')::numeric between 1.00 and 10000.00
   and p_notional::text = p_terms->>'notionalValue'
   and p_terms->'units'='null'::jsonb and p_terms->'price'='null'::jsonb and p_terms->'stop'='null'::jsonb
   and p_terms->'orderType'='"Market"'::jsonb and p_terms->'timeInForce'='"Day"'::jsonb
   and btrim(p_trade)<>'' and p_verification='request_bound'
   and (p_estimate is null or (p_estimate > 0 and p_estimate < 1000000000000)), false);
 end if;
 return false;
end $$;
revoke all on function public.snaptrade_order_review_amount_valid(text,numeric,numeric,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.snaptrade_order_review_amount_valid(text,numeric,numeric,text,jsonb,text) to service_role;

alter table public.snaptrade_order_reviews add constraint snaptrade_order_reviews_amount_check
 check (public.snaptrade_order_review_amount_valid(amount_mode,notional_value,estimate_units,amount_verification,terms,trade_id)) not valid;
-- Validates every historical row; any non-conforming row aborts the whole migration.
alter table public.snaptrade_order_reviews validate constraint snaptrade_order_reviews_amount_check;

-- 4. Shared create core (not callable by any API role). Same owner advisory
-- serialization, current-generation check and reservation rule as V3.
create or replace function public.snaptrade_order_review_create_core(
 p_id uuid,p_owner uuid,p_client text,p_vendor_user text,p_generation bigint,p_terms jsonb,
 p_impact_facts jsonb,p_symbol text,p_trade text,p_expires timestamptz,
 p_amount_mode text,p_notional numeric,p_estimate_units numeric,p_amount_verification text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.snaptrade_order_reviews; g bigint;
begin
 if not public.snaptrade_order_review_amount_valid(p_amount_mode,p_notional,p_estimate_units,p_amount_verification,p_terms,p_trade) then
  raise exception 'invalid order review amount terms' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 select generation into g from public.snaptrade_order_review_owners where owner_id=p_owner for update;
 if not found or g is distinct from p_generation then return null; end if;
 if exists(select 1 from public.snaptrade_order_reviews where owner_id=p_owner and state in ('submitting','unknown','complete')) then return null; end if;
 insert into public.snaptrade_order_reviews(id,owner_id,client_id,vendor_user_id,generation,terms,impact_facts,symbol_id,trade_id,expires_at,
  amount_mode,notional_value,estimate_units,amount_verification)
 values(p_id,p_owner,p_client,p_vendor_user,g,p_terms,p_impact_facts,p_symbol,p_trade,p_expires,
  p_amount_mode,p_notional,p_estimate_units,p_amount_verification) returning * into r;
 return to_jsonb(r);
end $$;
revoke all on function public.snaptrade_order_review_create_core(uuid,uuid,text,text,bigint,jsonb,jsonb,text,text,timestamptz,text,numeric,numeric,text)
 from public,anon,authenticated,service_role;

-- 5. Exact V3 create signature, now SHARES ONLY (legacy and canonical terms).
create or replace function public.create_snaptrade_order_review(
 p_id uuid,p_owner uuid,p_client text,p_vendor_user text,p_generation bigint,p_terms jsonb,
 p_impact_facts jsonb,p_symbol text,p_trade text,p_expires timestamptz)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 return public.snaptrade_order_review_create_core(p_id,p_owner,p_client,p_vendor_user,p_generation,p_terms,
  p_impact_facts,p_symbol,p_trade,p_expires,'shares',null,null,null);
end $$;
revoke all on function public.create_snaptrade_order_review(uuid,uuid,text,text,bigint,jsonb,jsonb,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.create_snaptrade_order_review(uuid,uuid,text,text,bigint,jsonb,jsonb,text,text,timestamptz) to service_role;

-- 6. Dollar overload: distinct named parameters, NO defaults (unambiguous
-- PostgREST resolution). Accepts dollars only; shares must use the V3 signature.
create or replace function public.create_snaptrade_order_review(
 p_id uuid,p_owner uuid,p_client text,p_vendor_user text,p_generation bigint,p_terms jsonb,
 p_impact_facts jsonb,p_symbol text,p_trade text,p_expires timestamptz,
 p_amount_mode text,p_notional numeric,p_estimate_units numeric,p_amount_verification text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_amount_mode is distinct from 'dollars' then raise exception 'dollar overload requires dollars' using errcode='22023'; end if;
 return public.snaptrade_order_review_create_core(p_id,p_owner,p_client,p_vendor_user,p_generation,p_terms,
  p_impact_facts,p_symbol,p_trade,p_expires,p_amount_mode,p_notional,p_estimate_units,p_amount_verification);
end $$;
revoke all on function public.create_snaptrade_order_review(uuid,uuid,text,text,bigint,jsonb,jsonb,text,text,timestamptz,text,numeric,numeric,text) from public,anon,authenticated;
grant execute on function public.create_snaptrade_order_review(uuid,uuid,text,text,bigint,jsonb,jsonb,text,text,timestamptz,text,numeric,numeric,text) to service_role;

-- 7. consume_snaptrade_order_review and snaptrade_review_generation are
-- amount-mode agnostic and remain exactly as installed by V3 (not redefined).

-- 8. Resolver: share branch identical to V3; dollar branch mirrors
-- dollarTerminalEvidence/ackQuantityEvidence. Unknown/submitting never resolve.
create or replace function public.resolve_acknowledged_snaptrade_review(
 p_id uuid,p_owner uuid,p_client text,p_vendor_user text,p_generation bigint,
 p_expected_result jsonb,p_expected_terms jsonb,p_expected_symbol text,p_evidence jsonb)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.snaptrade_order_reviews; g bigint; ack jsonb; ack_state text; total numeric; filled numeric; open_q numeric;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 select generation into g from public.snaptrade_order_review_owners where owner_id=p_owner for update;
 if not found or g is distinct from p_generation then return null; end if;
 select * into r from public.snaptrade_order_reviews where id=p_id and owner_id=p_owner for update;
 if not found or r.state<>'complete' or r.client_id is distinct from p_client or r.vendor_user_id is distinct from p_vendor_user
 or r.generation+1<>g or r.result is distinct from p_expected_result or r.terms is distinct from p_expected_terms or r.symbol_id is distinct from p_expected_symbol then return null; end if;
 if p_evidence->>'source' is distinct from 'snaptrade_order_detail'
 or p_evidence->>'brokerageOrderId' is distinct from r.result->>'brokerageOrderId'
 or p_evidence->>'accountId' is distinct from r.terms->>'accountId'
 or p_evidence->>'symbolId' is distinct from r.symbol_id
 or p_evidence->>'action' is distinct from r.terms->>'action'
 or p_evidence->>'orderType' is distinct from r.terms->>'orderType'
 or p_evidence->>'timeInForce' is distinct from r.terms->>'timeInForce'
 or p_evidence->'limitPrice' is distinct from r.terms->'price'
 or coalesce(p_evidence->>'status','') not in ('EXECUTED','CANCELED','REJECTED','EXPIRED') then return null; end if;
 if nullif(r.result->>'brokerageOrderId','') is null or r.result->>'accountId' is distinct from r.terms->>'accountId'
 or jsonb_typeof(p_evidence->'openQuantity') is distinct from 'number'
 or jsonb_typeof(p_evidence->'totalQuantity') is distinct from 'number' or jsonb_typeof(p_evidence->'filledQuantity') is distinct from 'number' then return null; end if;
 total := (p_evidence->>'totalQuantity')::numeric; filled := (p_evidence->>'filledQuantity')::numeric; open_q := (p_evidence->>'openQuantity')::numeric;
 if r.amount_mode='shares' then
  if open_q<>0 or total is distinct from (r.terms->>'units')::numeric
  or (case when p_evidence->>'status'='EXECUTED' then filled<>total else filled<>0 end) then return null; end if;
 elsif r.amount_mode='dollars' then
  -- Request intent binding; quantities are broker-actual, never notional-derived.
  if p_evidence->'amountMode' is distinct from '"dollars"'::jsonb
  or p_evidence->'notionalValue' is distinct from r.terms->'notionalValue'
  or p_evidence->'quantityBasis' is distinct from '"broker_actual"'::jsonb
  or r.terms->'orderType' is distinct from '"Market"'::jsonb or r.terms->'timeInForce' is distinct from '"Day"'::jsonb
  or open_q<>0 or total<0 or filled<0 then return null; end if;
  -- Placement ACK record: absent/null → no constraint (evidence ackQuantity
  -- must be JSON null); positive → immutable, must equal total and evidence;
  -- invalid, zero, missing or any other shape → stays locked.
  ack := r.result->'ackQuantity'; ack_state := case when jsonb_typeof(ack)='object' then ack->>'state' end;
  if ack_state in ('absent','null') then
   if p_evidence->'ackQuantity' is distinct from 'null'::jsonb then return null; end if;
  elsif ack_state='positive' then
   if jsonb_typeof(ack->'value') is distinct from 'number' or (ack->>'value')::numeric<=0
   or total is distinct from (ack->>'value')::numeric or p_evidence->'ackQuantity' is distinct from ack->'value' then return null; end if;
  else return null;
  end if;
  if (case when p_evidence->>'status'='EXECUTED' then not (total>0 and filled=total) else filled<>0 end) then return null; end if;
 else return null;
 end if;
 update public.snaptrade_order_reviews set state='resolved',result=result||jsonb_build_object('status',p_evidence->>'status','reconciliation',p_evidence) where id=p_id;
 update public.snaptrade_order_reviews set state='invalidated' where owner_id=p_owner and state='reviewing';
 update public.snaptrade_order_review_owners set generation=g+1 where owner_id=p_owner;
 return (g+1)::text;
end $$;
revoke all on function public.resolve_acknowledged_snaptrade_review(uuid,uuid,text,text,bigint,jsonb,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.resolve_acknowledged_snaptrade_review(uuid,uuid,text,text,bigint,jsonb,jsonb,text,jsonb) to service_role;

-- 9. Re-assert table isolation (unchanged from V3).
alter table public.snaptrade_order_reviews enable row level security;
alter table public.snaptrade_order_review_owners enable row level security;
revoke all on public.snaptrade_order_reviews, public.snaptrade_order_review_owners from public,anon,authenticated;
grant all on public.snaptrade_order_reviews, public.snaptrade_order_review_owners to service_role;

-- 10. Advertise version 4 LAST.
create or replace function public.snaptrade_order_review_storage_version()
returns integer language sql stable security invoker set search_path=public,pg_temp as $$ select 4 $$;
revoke all on function public.snaptrade_order_review_storage_version() from public,anon,authenticated;
grant execute on function public.snaptrade_order_review_storage_version() to service_role;

notify pgrst, 'reload schema';
commit;
