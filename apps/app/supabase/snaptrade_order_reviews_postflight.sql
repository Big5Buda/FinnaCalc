-- READ ONLY. Never consume/create/reconcile fixture reviews in production.
select relname,relrowsecurity from pg_class where oid in ('public.snaptrade_order_reviews'::regclass,'public.snaptrade_order_review_owners'::regclass);
select polname from pg_policy where polrelid in ('public.snaptrade_order_reviews'::regclass,'public.snaptrade_order_review_owners'::regclass);
select role,object,has_table_privilege(role,object,'SELECT') as can_select,has_table_privilege(role,object,'INSERT') as can_insert,
 has_table_privilege(role,object,'UPDATE') as can_update,has_table_privilege(role,object,'DELETE') as can_delete
 from unnest(array['anon','authenticated','service_role']) role cross join unnest(array['public.snaptrade_order_reviews','public.snaptrade_order_review_owners']) object;
select role,signature,has_function_privilege(role,signature,'EXECUTE') as can_execute
 from unnest(array['anon','authenticated','service_role']) role cross join unnest(array[
 'public.snaptrade_review_generation(uuid)',
 'public.create_snaptrade_order_review(uuid,uuid,text,text,bigint,jsonb,jsonb,text,text,timestamptz)',
 'public.consume_snaptrade_order_review(uuid,uuid,text,text)',
 'public.resolve_acknowledged_snaptrade_review(uuid,uuid,text,text,bigint,jsonb,jsonb,text,jsonb)',
 'public.snaptrade_order_review_storage_version()']) signature;
select proname,prosecdef,proconfig from pg_proc where pronamespace='public'::regnamespace and proname in
 ('snaptrade_review_generation','create_snaptrade_order_review','consume_snaptrade_order_review','resolve_acknowledged_snaptrade_review','snaptrade_order_review_storage_version');
begin read only;
set local role service_role;
select public.snaptrade_order_review_storage_version(); -- exactly 3
select id,impact_facts,generation from public.snaptrade_order_reviews limit 0;
select owner_id,generation from public.snaptrade_order_review_owners limit 0;
rollback;
