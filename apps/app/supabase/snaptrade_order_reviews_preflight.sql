-- READ ONLY metadata; if any target exists inspect exact schema/version first.
select current_database(),current_user,current_setting('server_version');
select rolname,rolbypassrls from pg_roles where rolname in ('anon','authenticated','service_role');
select to_regclass('auth.users') as owners,
 to_regclass('public.snaptrade_order_reviews') as review_table,
 to_regclass('public.snaptrade_order_review_owners') as generation_table;
select column_name,data_type,is_nullable from information_schema.columns
 where table_schema='public' and table_name in ('snaptrade_order_reviews','snaptrade_order_review_owners') order by table_name,ordinal_position;
select proname,pg_get_function_identity_arguments(oid) as signature from pg_proc
 where pronamespace='public'::regnamespace and proname in ('snaptrade_review_generation','create_snaptrade_order_review','consume_snaptrade_order_review','resolve_acknowledged_snaptrade_review','snaptrade_order_review_storage_version');

select conname,pg_get_constraintdef(oid) from pg_constraint where conrelid in
 (to_regclass('public.snaptrade_order_reviews'),to_regclass('public.snaptrade_order_review_owners'));
-- No order-review schema has been applied in production during this task. If
-- existing state is found, stop for an explicit state/generation upgrade review;
-- never reset counters or assume legacy acknowledged rows are auto-resolvable.
