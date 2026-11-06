-- VERSION 3 PREPARED ONLY. Root review/transactional preflight required.
create table if not exists public.snaptrade_order_reviews (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 client_id text not null, vendor_user_id text not null, terms jsonb not null,
 impact_facts jsonb, symbol_id text not null, trade_id text, expires_at timestamptz not null,
 state text not null default 'reviewing', result jsonb, generation bigint not null default 0,
 created_at timestamptz not null default now()
);
alter table public.snaptrade_order_reviews add column if not exists generation bigint not null default 0;
alter table public.snaptrade_order_reviews drop constraint if exists snaptrade_order_reviews_state_check;
alter table public.snaptrade_order_reviews add constraint snaptrade_order_reviews_state_check
 check(state in ('reviewing','submitting','complete','unknown','invalidated','resolved'));
create table if not exists public.snaptrade_order_review_owners (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 generation bigint not null default 0 check(generation>=0)
);
alter table public.snaptrade_order_reviews enable row level security;
alter table public.snaptrade_order_review_owners enable row level security;
revoke all on public.snaptrade_order_reviews, public.snaptrade_order_review_owners from public,anon,authenticated;
grant all on public.snaptrade_order_reviews, public.snaptrade_order_review_owners to service_role;
create or replace function public.snaptrade_review_generation(p_owner uuid)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare g bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 insert into public.snaptrade_order_review_owners(owner_id) values(p_owner) on conflict do nothing;
 select generation into g from public.snaptrade_order_review_owners where owner_id=p_owner;
 return g::text;
end $$;
revoke all on function public.snaptrade_review_generation(uuid) from public,anon,authenticated;
grant execute on function public.snaptrade_review_generation(uuid) to service_role;
-- Remove the old generation-less create overload; stale deployments fail closed.
drop function if exists public.create_snaptrade_order_review(uuid,uuid,text,text,jsonb,jsonb,text,text,timestamptz);
create or replace function public.create_snaptrade_order_review(
 p_id uuid,p_owner uuid,p_client text,p_vendor_user text,p_generation bigint,p_terms jsonb,
 p_impact_facts jsonb,p_symbol text,p_trade text,p_expires timestamptz)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.snaptrade_order_reviews; g bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 select generation into g from public.snaptrade_order_review_owners where owner_id=p_owner for update;
 if not found or g is distinct from p_generation then return null; end if;
 if exists(select 1 from public.snaptrade_order_reviews where owner_id=p_owner and state in ('submitting','unknown','complete')) then return null; end if;
 insert into public.snaptrade_order_reviews(id,owner_id,client_id,vendor_user_id,generation,terms,impact_facts,symbol_id,trade_id,expires_at)
 values(p_id,p_owner,p_client,p_vendor_user,g, p_terms,p_impact_facts,p_symbol,p_trade,p_expires) returning * into r;
 return to_jsonb(r);
end $$;
revoke all on function public.create_snaptrade_order_review(uuid,uuid,text,text,bigint,jsonb,jsonb,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.create_snaptrade_order_review(uuid,uuid,text,text,bigint,jsonb,jsonb,text,text,timestamptz) to service_role;
create or replace function public.consume_snaptrade_order_review(review_id uuid,owner uuid,client text,vendor_user text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.snaptrade_order_reviews; g bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended(owner::text,0));
 select generation into g from public.snaptrade_order_review_owners where owner_id=owner for update;
 if not found then return false; end if;
 select * into r from public.snaptrade_order_reviews where id=review_id and owner_id=owner for update;
 if not found or r.state<>'reviewing' or r.expires_at<=now() or r.client_id is distinct from client or r.vendor_user_id is distinct from vendor_user or r.generation is distinct from g then return false; end if;
 if exists(select 1 from public.snaptrade_order_reviews where owner_id=owner and state in ('submitting','unknown','complete')) then return false; end if;
 update public.snaptrade_order_review_owners set generation=g+1 where owner_id=owner;
 update public.snaptrade_order_reviews set state='submitting' where id=review_id;
 update public.snaptrade_order_reviews set state='invalidated' where owner_id=owner and id<>review_id and state='reviewing';
 return true;
end $$;
revoke all on function public.consume_snaptrade_order_review(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.consume_snaptrade_order_review(uuid,uuid,text,text) to service_role;
-- Only acknowledged known-ID orders may use routine terminal reconciliation.
-- Unknown/submitting are never automatically resolved by this RPC.
create or replace function public.resolve_acknowledged_snaptrade_review(
 p_id uuid,p_owner uuid,p_client text,p_vendor_user text,p_generation bigint,
 p_expected_result jsonb,p_expected_terms jsonb,p_expected_symbol text,p_evidence jsonb)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.snaptrade_order_reviews; g bigint;
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
 if (p_evidence->>'openQuantity')::numeric<>0 or (p_evidence->>'totalQuantity')::numeric is distinct from (r.terms->>'units')::numeric
 or (case when p_evidence->>'status'='EXECUTED' then (p_evidence->>'filledQuantity')::numeric<>(p_evidence->>'totalQuantity')::numeric else (p_evidence->>'filledQuantity')::numeric<>0 end) then return null; end if;
 update public.snaptrade_order_reviews set state='resolved',result=result||jsonb_build_object('status',p_evidence->>'status','reconciliation',p_evidence) where id=p_id;
 update public.snaptrade_order_reviews set state='invalidated' where owner_id=p_owner and state='reviewing';
 update public.snaptrade_order_review_owners set generation=g+1 where owner_id=p_owner;
 return (g+1)::text;
end $$;
revoke all on function public.resolve_acknowledged_snaptrade_review(uuid,uuid,text,text,bigint,jsonb,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.resolve_acknowledged_snaptrade_review(uuid,uuid,text,text,bigint,jsonb,jsonb,text,jsonb) to service_role;
create or replace function public.snaptrade_order_review_storage_version()
returns integer language sql stable security invoker set search_path=public,pg_temp as $$ select 3 $$;
revoke all on function public.snaptrade_order_review_storage_version() from public,anon,authenticated;
grant execute on function public.snaptrade_order_review_storage_version() to service_role;
-- Publish new RPC signatures through the supported schema cache notification.
notify pgrst, 'reload schema';
