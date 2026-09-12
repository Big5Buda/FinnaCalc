// Local embedded PostgreSQL only. No production database or vendor credentials.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const scratch = await mkdtemp(join(tmpdir(), "finnacalc-snaptrade-ownership-"))
const legacy = "FINNACALC-TEST-PKUEY"
const production = "FINNACALC-DRGER"
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`
let db
let checks = 0
function check(actual, expected, label) { assert.deepEqual(actual, expected, label); checks++ }
async function rejects(sql, text) { await assert.rejects(db.exec(sql), new RegExp(text)); checks++ }
async function rows() { return (await db.query("select * from snaptrade_users order by user_id")).rows }
try {
    execFileSync("npm", ["install", "--prefix", scratch, "--no-save", "--package-lock=false",
        "--ignore-scripts", "--no-audit", "--no-fund", "@electric-sql/pglite@0.5.8"], { stdio: "pipe" })
    const { PGlite } = createRequire(join(scratch, "package.json"))("@electric-sql/pglite")
    db = await PGlite.create()
    await db.exec(`create role anon; create role authenticated; create role service_role;
        create schema auth; create table auth.users(id uuid primary key);`)
    await db.exec(await readFile(join(app, "supabase/snaptrade_users.sql"), "utf8"))
    for (let n = 1; n <= 5; n++) await db.query("insert into auth.users values ($1)", [id(n)])
    for (let n = 1; n <= 3; n++) await db.query(
        "insert into snaptrade_users(user_id,st_user_id,st_user_secret) values($1,$2,$3)", [id(n), `old-${n}`, `fixture-secret-${n}`])
    const before = await rows()
    const migration = await readFile(join(app, "supabase/snaptrade_key_ownership.sql"), "utf8")
    await db.exec(migration)
    check((await rows()).map(({ client_id, ...row }) => row), before, "all three original rows preserved byte for byte")
    check((await rows()).map(row => row.client_id), [legacy, legacy, legacy], "explicit legacy backfill")
    // Old writers remain compatible before and while new code is rolled out.
    await db.query("insert into snaptrade_users(user_id,st_user_id,st_user_secret) values($1,'old-4','fixture-four')", [id(4)])
    check((await rows())[3].client_id, legacy, "old writer uses legacy default after expand")
    await db.query("insert into snaptrade_users(user_id,st_user_id,st_user_secret,client_id) values($1,'new-5','fixture-five',$2)", [id(5), production])
    await db.exec(migration)
    check((await rows())[4].client_id, production, "reapplying migration never relabels production rows")
    check((await rows()).length, 5, "migration reapply preserves mixed rows")
    for (const n of [1, 5]) {
        await rejects(`delete from snaptrade_users where user_id='${id(n)}'`, "requires_verified_owner_deletion")
        await rejects(`delete from auth.users where id='${id(n)}'`, "requires_verified_owner_deletion")
    }
    check((await rows()).length, 5, "old direct deletes and account cascades cannot discard credentials")
    await rejects(`update snaptrade_users set client_id='${production}' where user_id='${id(1)}'`, "ownership_is_immutable")
    await rejects(`update snaptrade_users set st_user_secret='replacement' where user_id='${id(1)}'`, "ownership_is_immutable")
    await rejects(`select delete_snaptrade_session('${id(1)}','${production}','old-1')`, "owner_changed")
    await rejects(`select delete_snaptrade_session('${id(1)}','${legacy}','stale-user')`, "owner_changed")
    check((await rows()).length, 5, "mismatched key/user deletion leaves all rows intact")
    const privileges = (await db.query(`select role,
        has_function_privilege(role, 'public.delete_snaptrade_session(uuid,text,text)', 'execute') as allowed
        from (values ('anon'), ('authenticated'), ('service_role')) roles(role) order by role`)).rows
    check(privileges, [{ role: "anon", allowed: false }, { role: "authenticated", allowed: false },
        { role: "service_role", allowed: true }], "only service role can call the deletion RPC")
    check((await db.query("select relrowsecurity as rls from pg_class where oid='public.snaptrade_users'::regclass")).rows[0].rls, true, "RLS retained")
    // Calling the service-only RPC after vendor acceptance is idempotent.
    await db.exec(`set role service_role; select public.delete_snaptrade_session('${id(1)}','${legacy}','old-1');
        select public.delete_snaptrade_session('${id(1)}','${legacy}','old-1'); reset role;`)
    check((await rows()).length, 4, "accepted legacy deletion and retry remove exactly one row")
    await db.query("insert into snaptrade_users(user_id,st_user_id,st_user_secret,client_id) values($1,'replacement-user','fixture-replacement',$2)", [id(1), production])
    await rejects(`select delete_snaptrade_session('${id(1)}','${legacy}','old-1')`, "owner_changed")
    check((await rows()).length, 5, "stale retry cannot delete a replacement mapping")
    await db.exec(`select delete_snaptrade_session('${id(5)}','${production}','new-5');`)
    await rejects(`delete from snaptrade_users where user_id='${id(2)}'`, "requires_verified_owner_deletion")
    await db.exec(`delete from auth.users where id='${id(5)}';`)
    check((await db.query("select count(*)::int as n from auth.users")).rows[0].n, 4, "account deletion works after its accepted brokerage removal")
    console.log(`PASS: ${checks} SnapTrade SQL ownership, backfill, mixed-version, ACL and retry checks.`)
} finally {
    if (db) await db.close()
    await rm(scratch, { recursive: true, force: true })
}
