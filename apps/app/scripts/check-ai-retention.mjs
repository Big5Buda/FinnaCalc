// Local-only SQL regression: no credentials, network database or production data.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const scratch = await mkdtemp(join(tmpdir(), "finnacalc-retention-"))
let db
let checks = 0
function check(actual, expected, label) {
    assert.deepEqual(actual, expected, label)
    checks += 1
}

try {
    // The isolated, pinned test dependency never changes the application's lockfile.
    execFileSync("npm", ["install", "--prefix", scratch, "--no-save", "--package-lock=false",
        "--ignore-scripts", "--no-audit", "--no-fund", "@electric-sql/pglite@0.5.8"], { stdio: "pipe" })
    const { PGlite } = createRequire(join(scratch, "package.json"))("@electric-sql/pglite")
    db = await PGlite.create()
    await db.exec(`
        create role anon;
        create role authenticated;
        create role service_role;
        create schema auth;
        create table auth.users (id uuid primary key);
        insert into auth.users values ('00000000-0000-0000-0000-000000000001');
        -- Only the extension/scheduler boundary is stubbed. The actual table,
        -- function, index, owner and ACL SQL execute without substitutions.
        create schema cron;
        create table cron.job (
            jobid bigint generated always as identity primary key,
            jobname text unique not null,
            schedule text not null,
            command text not null,
            username text not null default current_user,
            active boolean not null default true
        );
        create function cron.schedule(job_name text, schedule text, command text)
        returns bigint language sql as $stub$
            insert into cron.job (jobname, schedule, command)
            values ($1, $2, $3)
            on conflict (jobname) do update
              set schedule = excluded.schedule, command = excluded.command, active = true
            returning jobid;
        $stub$;
    `)
    await db.exec(await readFile(join(app, "supabase/ai_transcripts.sql"), "utf8"))
    const original = await readFile(join(app, "supabase/ai_transcript_retention.sql"), "utf8")
    const extension = "create extension if not exists pg_cron with schema pg_catalog;"
    check(original.split(extension).length, 2, "explicit extension setup remains part of production migration")
    const migration = original.replace(extension, "-- pg_cron boundary stubbed for embedded PostgreSQL only.")
    await db.exec(migration)
    await db.exec(migration)
    const jobs = (await db.query("select jobname, schedule, command, username, active from cron.job")).rows
    check(jobs, [{ jobname: "ai-transcripts-retention-30-days", schedule: "0 * * * *",
        command: "select public.purge_expired_ai_transcripts();", username: "postgres", active: true }],
    "migration registers one named hourly cleanup; scheduler execution itself is not tested")
    const index = (await db.query(`select indexdef from pg_indexes
        where schemaname = 'public' and indexname = 'ai_transcripts_created_at_idx'`)).rows
    check(index.length, 1, "global timestamp index exists after reapply")
    check(index[0].indexdef.endsWith("(created_at)"), true, "index is global rather than per-user")
    const functionConfig = (await db.query(`select p.prosecdef, p.proconfig, r.rolname as owner
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        join pg_roles r on r.oid = p.proowner
        where n.nspname = 'public' and p.proname = 'purge_expired_ai_transcripts'`)).rows[0]
    check(functionConfig.prosecdef, true, "fixed privileged function")
    check(functionConfig.owner, "postgres", "stable function owner")
    check(functionConfig.proconfig.includes('search_path=""'), true, "empty search path")
    check(functionConfig.proconfig.includes("TimeZone=UTC"), true, "UTC cutoff independent of caller timezone")

    for (const role of ["anon", "authenticated", "service_role"]) {
        const allowed = (await db.query(`select has_function_privilege($1,
            'public.purge_expired_ai_transcripts()', 'EXECUTE') as allowed`, [role])).rows[0].allowed
        check(allowed, role === "service_role", `${role} execute privilege`)
    }
    const publicExecute = (await db.query(`select exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
        lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
        where n.nspname = 'public' and p.proname = 'purge_expired_ai_transcripts'
          and acl.grantee = 0 and acl.privilege_type = 'EXECUTE') as allowed`)).rows[0].allowed
    check(publicExecute, false, "no PUBLIC execute grant")

    // Seed and purge within one transaction: CURRENT_TIMESTAMP is stable,
    // allowing a genuine one-microsecond boundary assertion without clock races.
    await db.exec(`
        begin;
        set local timezone = 'America/Chicago';
        insert into public.ai_transcripts (user_id, route, question, answer, model, created_at)
        select u.id, route, 'expired-fixture', 'test', 'test',
               current_timestamp - interval '720 hours' - interval '1 microsecond'
        from (values (null::uuid), ('00000000-0000-0000-0000-000000000001'::uuid)) as u(id)
        cross join (values ('chat'), ('budget-advisor'), ('budget-fixes')) as routes(route);
        insert into public.ai_transcripts (user_id, route, question, answer, model, created_at)
        select u.id, 'chat', marker, 'test', 'test', current_timestamp - interval '720 hours' + delta
        from (values (null::uuid), ('00000000-0000-0000-0000-000000000001'::uuid)) as u(id)
        cross join (values ('at-cutoff', interval '0 seconds'),
                           ('after-cutoff', interval '1 microsecond'),
                           ('recent', interval '1 day')) as times(marker, delta);
        set local role service_role;
    `)
    check((await db.query("select public.purge_expired_ai_transcripts() as deleted")).rows[0].deleted,
        6, "all three routes and both account states expire; exact cutoff survives")
    check((await db.query("select public.purge_expired_ai_transcripts() as deleted")).rows[0].deleted,
        0, "repeated purge is idempotent")
    await db.exec("reset role;")
    check((await db.query("select count(*)::int as count from public.ai_transcripts")).rows[0].count,
        6, "six unexpired/exact-boundary rows retained")
    check((await db.query("select count(*)::int as count from public.ai_transcripts where question = 'at-cutoff'")).rows[0].count,
        2, "strict cutoff for signed-in and signed-out rows")
    await db.exec("commit;")

    // Grant the usual Supabase table privilege to prove RLS still hides rows;
    // lack of a table grant would otherwise mask a broken RLS policy.
    await db.exec("grant select on public.ai_transcripts to anon, authenticated;")
    for (const role of ["anon", "authenticated"]) {
        await db.exec(`set role ${role};`)
        check((await db.query("select count(*)::int as count from public.ai_transcripts")).rows[0].count,
            0, `${role} cannot read transcripts under RLS`)
        await assert.rejects(db.query("select public.purge_expired_ai_transcripts();"),
            (error) => error.code === "42501", `${role} cannot invoke privileged cleanup`)
        checks += 1
        await db.exec("reset role;")
    }
    console.log(`AI retention SQL checks passed (${checks}). Embedded PostgreSQL only; pg_cron scheduling is stubbed, no live database touched.`)
} finally {
    await db?.close()
    await rm(scratch, { recursive: true, force: true })
}
