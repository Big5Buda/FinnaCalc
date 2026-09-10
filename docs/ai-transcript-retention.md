# AI transcript retention

The owner selected 30 days for FinnaCalc's AI transcript records. The migration
is prepared in `apps/app/supabase/ai_transcript_retention.sql`; committing or
deploying the Next.js application does **not** install this database job.

Every hour the job deletes rows whose `created_at` is strictly earlier than
the run's transaction timestamp minus 30 UTC days (720 hours). It includes
signed-in and signed-out rows and the `chat`, `budget-advisor` and `budget-fixes`
routes. A row exactly at the cutoff survives that run. With a healthy hourly
schedule, expired rows are removed on the next run, normally within an hour.
Account deletion continues to delete that account's rows sooner.

A transcript stores the latest question (or budget-finding text), the answer
shown, screened-out text and metadata. Portfolio context embedded in the latest
message is stored with that message. The full structured budget snapshot is
sent to Google as model context but is not separately written to this table;
questions, findings and answers can still contain budget figures or identifying
information. A null `user_id` means no account association, not anonymized text.
Application advice-screening logs record the rule and event without the removed
sentence. This migration governs the active database table; it does not configure
Google retention, hosting-provider logs, or Supabase backup expiry. Confirm
those provider settings separately before making broader retention promises.

## Apply and verify

1. Apply `apps/app/supabase/ai_transcripts.sql` if the table is not installed.
2. In the Supabase SQL editor, select the `postgres` role. Review the table size
   and pending deletion count without exposing transcript content:

   ```sql
   select count(*) as rows_due,
          min(created_at) as oldest_due
   from public.ai_transcripts
   where created_at < current_timestamp - interval '720 hours';
   ```

3. Apply `apps/app/supabase/ai_transcript_retention.sql`. It enables `pg_cron`,
   creates a global timestamp index and a restricted cleanup function, and
   schedules the named hourly job. Apply it as the same `postgres` role each
   time; reapplying updates that job. The first automatic deletion occurs at the
   next hour. The index's first creation can briefly block table writes, so
   schedule installation appropriately for the table's current size.
4. Inspect the installed job, function privileges and index:

   ```sql
   select jobid, jobname, schedule, command, username, active
   from cron.job where jobname = 'ai-transcripts-retention-30-days';

   select has_function_privilege('anon', 'public.purge_expired_ai_transcripts()', 'EXECUTE') as anon_must_be_false,
          has_function_privilege('authenticated', 'public.purge_expired_ai_transcripts()', 'EXECUTE') as authenticated_must_be_false,
          has_function_privilege('service_role', 'public.purge_expired_ai_transcripts()', 'EXECUTE') as service_must_be_true;

   select indexdef from pg_indexes
   where schemaname = 'public' and indexname = 'ai_transcripts_created_at_idx';
   ```

   Expect one active hourly job owned by `postgres`, false/false/true privileges
   and an index on `created_at`. To perform the initial purge immediately after
   deployment approval, run `select public.purge_expired_ai_transcripts();` as
   `postgres`; its result is the number of rows deleted. Deletion is permanent
   in the active table, so inspect the count before this step.

## Monitor

Check recent executions in Supabase Integrations → Cron or with:

```sql
select r.jobid, r.status, r.return_message, r.start_time, r.end_time
from cron.job_run_details r
join cron.job j on j.jobid = r.jobid
where j.jobname = 'ai-transcripts-retention-30-days'
order by r.start_time desc limit 24;

select max(r.end_time) filter (where r.status = 'succeeded') as last_success
from cron.job_run_details r
join cron.job j on j.jobid = r.jobid
where j.jobname = 'ai-transcripts-retention-30-days';

select count(*) as older_than_schedule_window
from public.ai_transcripts
where created_at < current_timestamp - interval '721 hours';
```

Investigate any failed run, no successful run within 90 minutes, or records older
than the normal hourly cleanup window. An installed job alone is not evidence
that cleanup is executing. After a database restore, recheck the job and run a
purge before serving restored transcript data. Backups follow the separately
configured Supabase backup lifecycle.

To pause only this cleanup job during an incident:

```sql
select cron.unschedule('ai-transcripts-retention-30-days');
```

Reapply the migration to resume. Unscheduling does not restore deleted rows.
Do not uninstall `pg_cron` to pause this job; that removes other jobs too.

## Reproducible local validation

From the monorepo root:

```sh
node apps/app/scripts/check-ai-retention.mjs
```

The check installs a pinned PGlite package into a temporary directory and runs
the actual table and function SQL in an isolated embedded PostgreSQL database.
It validates exact cutoff boundaries, signed-out and signed-in rows, all routes,
repeat purges, RLS/execute restrictions, and reapplication of the migration.
It never reads environment credentials or connects to a live database. Network
access is needed to fetch the pinned package when it is not in npm's cache.

PGlite does not run `pg_cron`; the harness replaces only its extension setup and
named-scheduler boundary with a documented test stub. Successful local checks do
not prove extension installation, real hourly scheduling, or production cleanup.
The deployment checks above remain required.

References: [Supabase Cron installation](https://supabase.com/docs/guides/cron/install),
[quickstart](https://supabase.com/docs/guides/cron/quickstart),
[monitoring and debugging](https://supabase.com/docs/guides/troubleshooting/pgcron-debugging-guide-n1KTaz),
[pg_cron named jobs](https://github.com/citusdata/pg_cron), and
[PGlite](https://pglite.dev/docs/).
