-- Apply after ai_transcripts.sql, as postgres in the Supabase SQL editor.
-- Policy selected by the owner: remove transcript rows older than 30 days.
-- Includes signed-out rows (user_id IS NULL) and every transcript route.
-- Reapplying updates the same named job; it does not create another schedule.
begin;

-- A stable scheduler owner avoids duplicate per-user named jobs on reapply.
do $check$
begin
  if current_user <> 'postgres' then
    raise exception 'Run ai_transcript_retention.sql as the postgres database role';
  end if;
end;
$check$;

create extension if not exists pg_cron with schema pg_catalog;

-- The existing (user_id, created_at) index cannot efficiently purge across users.
create index if not exists ai_transcripts_created_at_idx
  on public.ai_transcripts (created_at);

create or replace function public.purge_expired_ai_transcripts()
returns bigint
language plpgsql
security definer
set search_path = ''
set timezone = 'UTC'
as $function$
declare
  deleted_rows bigint;
begin
  -- UTC makes 30 days exactly 720 hours even across daylight-saving changes.
  -- Strictly older: a row exactly at the cutoff survives this run.
  delete from public.ai_transcripts
  where created_at < current_timestamp - interval '30 days';
  get diagnostics deleted_rows = row_count;
  return deleted_rows;
end;
$function$;

alter function public.purge_expired_ai_transcripts() owner to postgres;
revoke all on function public.purge_expired_ai_transcripts() from public, anon, authenticated;
grant execute on function public.purge_expired_ai_transcripts() to service_role;

comment on function public.purge_expired_ai_transcripts() is
  'Service-only cleanup of all AI transcripts strictly older than 30 UTC days; returns deleted row count.';

select cron.schedule(
  'ai-transcripts-retention-30-days',
  '0 * * * *',
  $job$select public.purge_expired_ai_transcripts();$job$
);

commit;
