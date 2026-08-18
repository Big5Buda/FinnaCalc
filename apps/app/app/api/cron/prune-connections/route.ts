import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSnapTrade, isSnapTradeConfigured } from "@/lib/snaptrade"

/**
 * Hangs up on brokerage connections nobody has come back for.
 *
 * SnapTrade bills per connected user every month whether or not the app is
 * ever opened again, and brokerage connections are open to free accounts, so
 * there is no subscription lapse to hang the teardown on. Time since last use
 * is the only signal available.
 *
 * PLAID IS DELIBERATELY NOT HERE, and this is the correction that matters.
 * An earlier version pruned bank connections on the same timer, which would
 * have disconnected a Budgeting Plus subscriber who simply had not opened the
 * app for six weeks. They are still paying. Banks are torn down when the
 * subscription that paid for them ends, which the app handles the moment it
 * sees the entitlement go (EntitlementStore.tearDownLapsedConnections), and
 * never on a clock. Do not add plaid_items to this file.
 *
 * Paying investing subscribers are exempt for the same reason. The app stamps
 * `has_investing` alongside the ping, so somebody paying for Investing Plus or
 * Pro keeps their brokerage however long they stay away. Only unpaid, unused
 * connections are pruned, which is the only case that is pure cost.
 *
 * DORMANT_DAYS is generous on purpose. Someone who checks a portfolio
 * quarterly is a real user, and a disconnection they did not ask for is a bad
 * surprise that costs them a reconnection.
 *
 * Safety, ordered by how badly each would go wrong:
 *
 *   1. NO COLUMN, NO ACTION. Before supabase/last_seen.sql has been run there
 *      is no last_seen_at. Treating missing or null as "never seen" would
 *      disconnect every user at once on the first run. The query asks for rows
 *      OLDER than the cutoff, so a missing column errors and aborts before
 *      touching anything.
 *   2. NULL IS NEVER DORMANT. A row written before this shipped means
 *      "unknown", not "abandoned".
 *   3. Removal happens at SnapTrade first, the row goes second, because the
 *      reverse strands a billed connection with its credential discarded.
 *   4. Idempotent: a connection already gone counts as success.
 *
 * Scheduled by vercel.json. Vercel sends CRON_SECRET as a bearer token and the
 * route refuses anything else, so it cannot be triggered from outside.
 */
export const dynamic = "force-dynamic"
export const maxDuration = 60

const DORMANT_DAYS = 45

function authorised(req: NextRequest): boolean {
    const secret = process.env.CRON_SECRET
    if (!secret) return false
    return req.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
    if (!authorised(req)) {
        return NextResponse.json({ error: "Not authorised." }, { status: 401 })
    }
    if (!isSnapTradeConfigured()) {
        return NextResponse.json({ skipped: "SnapTrade not configured." })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceRole) {
        return NextResponse.json({ error: "Not configured." }, { status: 503 })
    }
    const admin = createClient(url, serviceRole, {
        auth: { autoRefreshToken: false, persistSession: false },
    })

    const cutoff = new Date(Date.now() - DORMANT_DAYS * 86_400_000).toISOString()
    const errors: string[] = []
    let removed = 0

    const { data, error } = await admin
        .from("snaptrade_users")
        .select("user_id, st_user_id, has_investing")
        .lt("last_seen_at", cutoff)
    if (error) {
        // A missing column lands here, and aborting is the point: see 1.
        return NextResponse.json({ error: `snaptrade_users: ${error.message}` }, { status: 500 })
    }

    const st = getSnapTrade()
    let exempt = 0
    for (const row of (data ?? []) as any[]) {
        // Paying for investing keeps the connection, however long the gap.
        if (row.has_investing === true) {
            exempt += 1
            continue
        }
        try {
            await st.authentication.deleteSnapTradeUser({ userId: row.st_user_id })
        } catch (err: any) {
            // 404 means SnapTrade has already forgotten them, which is the
            // state we wanted.
            if (err?.response?.status !== 404) {
                errors.push(`snaptrade ${row.user_id}`)
                continue
            }
        }
        await admin.from("snaptrade_users").delete().eq("user_id", row.user_id)
        removed += 1
    }

    return NextResponse.json({ cutoff, dormantDays: DORMANT_DAYS, removed, exempt, errors })
}
