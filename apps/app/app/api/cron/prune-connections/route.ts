import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getPlaidClient, isPlaidConfigured } from "@/lib/plaid"
import { getSnapTrade, isSnapTradeConfigured } from "@/lib/snaptrade"

/**
 * Hangs up on connections nobody has come back for.
 *
 * Plaid bills per linked Item and SnapTrade per connected user, every month,
 * whether or not the app is ever opened again. An account that went quiet a
 * year ago costs exactly what an active one costs. This ends those.
 *
 * DORMANT_DAYS is deliberately generous. Someone who budgets quarterly, or
 * takes a long holiday, or simply forgets for a month, is a real user, and a
 * disconnection they did not ask for is a bad surprise that costs them a
 * reconnection. Forty five days is longer than any ordinary gap and short
 * enough that an abandoned account does not bill for a year.
 *
 * Safety, ordered by how badly each would go wrong:
 *
 *   1. NO COLUMN, NO ACTION. Before supabase/last_seen.sql has been run there
 *      is no last_seen_at. Treating a missing or null value as "never seen"
 *      would disconnect the entire user base on the first run. The query asks
 *      explicitly for rows OLDER than the cutoff, so a missing column makes it
 *      error and the route aborts before touching anything.
 *   2. NULL IS NEVER DORMANT. A row written before this shipped, or by a path
 *      that forgets to stamp it, means "unknown", not "abandoned".
 *   3. Removal happens at the vendor first and the row goes second, because
 *      the reverse strands a billed connection with its credential discarded.
 *   4. Idempotent: a connection already gone counts as success.
 *
 * The user finds out on their next launch. The app remembers locally that it
 * had a connection, so when the server reports none it can say what happened
 * instead of silently showing an empty page.
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

function alreadyGone(err: any): boolean {
    const code = err?.response?.data?.error_code
    return code === "ITEM_NOT_FOUND" || code === "INVALID_ACCESS_TOKEN"
}

export async function GET(req: NextRequest) {
    if (!authorised(req)) {
        return NextResponse.json({ error: "Not authorised." }, { status: 401 })
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
    const result = { plaidRemoved: 0, snaptradeRemoved: 0, errors: [] as string[] }

    // ---- Plaid
    if (isPlaidConfigured()) {
        const { data, error } = await admin
            .from("plaid_items")
            .select("user_id, item_id, access_token")
            .lt("last_seen_at", cutoff)
        if (error) {
            // A missing column lands here, and aborting is the point: see 1.
            return NextResponse.json({ error: `plaid_items: ${error.message}` }, { status: 500 })
        }
        const plaid = getPlaidClient()
        for (const row of (data ?? []) as any[]) {
            try {
                await plaid.itemRemove({ access_token: row.access_token })
            } catch (err: any) {
                if (!alreadyGone(err)) {
                    result.errors.push(`plaid ${row.item_id}`)
                    continue
                }
            }
            await admin.from("plaid_items").delete().eq("item_id", row.item_id)
            result.plaidRemoved += 1
        }
    }

    // ---- SnapTrade
    if (isSnapTradeConfigured()) {
        const { data, error } = await admin
            .from("snaptrade_users")
            .select("user_id, st_user_id, st_user_secret")
            .lt("last_seen_at", cutoff)
        if (error) {
            return NextResponse.json({ error: `snaptrade_users: ${error.message}` }, { status: 500 })
        }
        const st = getSnapTrade()
        for (const row of (data ?? []) as any[]) {
            try {
                await st.authentication.deleteSnapTradeUser({ userId: row.st_user_id })
            } catch (err: any) {
                // 404 means SnapTrade has already forgotten them, which is the
                // state we wanted.
                if (err?.response?.status !== 404) {
                    result.errors.push(`snaptrade ${row.user_id}`)
                    continue
                }
            }
            await admin.from("snaptrade_users").delete().eq("user_id", row.user_id)
            result.snaptradeRemoved += 1
        }
    }

    return NextResponse.json({ cutoff, dormantDays: DORMANT_DAYS, ...result })
}
