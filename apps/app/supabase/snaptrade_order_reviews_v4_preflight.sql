-- READ ONLY. Run immediately before snaptrade_order_reviews_v4.sql; STOP on any surprise.
select current_database(),current_user,current_setting('server_version');
begin read only;
set local role service_role;
select public.snaptrade_order_review_storage_version() as version; -- must be exactly 3
rollback;
-- V4 objects must not exist yet (expect 0 rows each).
select column_name from information_schema.columns where table_schema='public' and table_name='snaptrade_order_reviews'
 and column_name in ('amount_mode','notional_value','estimate_units','amount_verification');
select proname,pg_get_function_identity_arguments(oid) from pg_proc where pronamespace='public'::regnamespace
 and proname in ('snaptrade_order_review_amount_valid','snaptrade_order_review_create_core')
 or (proname='create_snaptrade_order_review' and pronargs<>10 and pronamespace='public'::regnamespace);
-- Row census to compare with postflight (only 'reviewing' may change → 'invalidated').
select state,count(*) from public.snaptrade_order_reviews group by state order by state;
select count(*) as owners,coalesce(sum(generation),0)::text as generation_sum,coalesce(max(generation),0)::text as generation_max
 from public.snaptrade_order_review_owners;
-- Every existing row must be a valid legacy/canonical SHARE review, else the
-- migration's VALIDATE CONSTRAINT aborts. Expect 0 rows.
select id,state from public.snaptrade_order_reviews where not coalesce(
 jsonb_typeof(terms)='object' and jsonb_typeof(terms->'units')='number' and (terms->>'units')::numeric>0
 and (not (terms ? 'amountMode') or terms->'amountMode'='"shares"'::jsonb)
 and (not (terms ? 'notionalValue') or terms->'notionalValue'='null'::jsonb), false);
-- Fingerprint of submitting/unknown/complete/resolved rows (must be byte-identical after).
select md5(string_agg(id::text||state||coalesce(result::text,'∅')||terms::text||generation::text, '|' order by id)) as preserved_fingerprint
 from public.snaptrade_order_reviews where state not in ('reviewing','invalidated');
