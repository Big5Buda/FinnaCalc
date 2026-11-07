-- READ ONLY. Never create/consume/resolve fixture reviews in production.
begin read only;
set local role service_role;
select public.snaptrade_order_review_storage_version() as version; -- exactly 4
select id,impact_facts,generation,amount_mode,notional_value,estimate_units,amount_verification from public.snaptrade_order_reviews limit 0;
select owner_id,generation from public.snaptrade_order_review_owners limit 0;
rollback;
-- Census: identical to preflight except no 'reviewing' rows (moved to 'invalidated');
-- owner count/generation sum/max unchanged; fingerprint of non-reviewing rows unchanged.
select state,amount_mode,count(*) from public.snaptrade_order_reviews group by state,amount_mode order by 1,2;
select count(*) as owners,coalesce(sum(generation),0)::text as generation_sum,coalesce(max(generation),0)::text as generation_max
 from public.snaptrade_order_review_owners;
select md5(string_agg(id::text||state||coalesce(result::text,'∅')||terms::text||generation::text, '|' order by id)) as preserved_fingerprint
 from public.snaptrade_order_reviews where state not in ('reviewing','invalidated');
-- Constraint present and VALIDATED; amount_mode NOT NULL.
select conname,convalidated,pg_get_constraintdef(oid) from pg_constraint where conrelid='public.snaptrade_order_reviews'::regclass
 and conname in ('snaptrade_order_reviews_amount_check','snaptrade_order_reviews_state_check');
select column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name='snaptrade_order_reviews'
 and column_name in ('amount_mode','notional_value','estimate_units','amount_verification') order by column_name;
-- RLS on, zero policies, no client table access.
select relname,relrowsecurity from pg_class where oid in ('public.snaptrade_order_reviews'::regclass,'public.snaptrade_order_review_owners'::regclass);
select polname from pg_policy where polrelid in ('public.snaptrade_order_reviews'::regclass,'public.snaptrade_order_review_owners'::regclass);
select role,object,has_table_privilege(role,object,'SELECT') s,has_table_privilege(role,object,'INSERT') i,
 has_table_privilege(role,object,'UPDATE') u,has_table_privilege(role,object,'DELETE') d
 from unnest(array['anon','authenticated','service_role']) role cross join unnest(array['public.snaptrade_order_reviews','public.snaptrade_order_review_owners']) object;
-- Function ACLs: service_role only on API RPCs; the create core is executable by NO API role.
select role,signature,has_function_privilege(role,signature,'EXECUTE') as can_execute
 from unnest(array['anon','authenticated','service_role']) role cross join unnest(array[
 'public.snaptrade_review_generation(uuid)',
 'public.create_snaptrade_order_review(uuid,uuid,text,text,bigint,jsonb,jsonb,text,text,timestamptz)',
 'public.create_snaptrade_order_review(uuid,uuid,text,text,bigint,jsonb,jsonb,text,text,timestamptz,text,numeric,numeric,text)',
 'public.snaptrade_order_review_create_core(uuid,uuid,text,text,bigint,jsonb,jsonb,text,text,timestamptz,text,numeric,numeric,text)',
 'public.snaptrade_order_review_amount_valid(text,numeric,numeric,text,jsonb,text)',
 'public.consume_snaptrade_order_review(uuid,uuid,text,text)',
 'public.resolve_acknowledged_snaptrade_review(uuid,uuid,text,text,bigint,jsonb,jsonb,text,jsonb)',
 'public.snaptrade_order_review_storage_version()']) signature;
-- Definer functions keep a fixed search_path; no create overload has defaults.
select proname,pg_get_function_identity_arguments(oid) sig,prosecdef,proconfig,pronargdefaults from pg_proc
 where pronamespace='public'::regnamespace and proname in ('snaptrade_review_generation','create_snaptrade_order_review',
 'snaptrade_order_review_create_core','snaptrade_order_review_amount_valid','consume_snaptrade_order_review',
 'resolve_acknowledged_snaptrade_review','snaptrade_order_review_storage_version') order by 1,2;
