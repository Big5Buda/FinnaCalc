import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifiedAppUserId } from "@/lib/supabase-auth"

/**
 * "I am still here." Called by the app on launch, once a day.
 *
 * SnapTrade bills per connected user every month whether or not anyone opens
 * the app, and brokerage connections are open to free accounts, so there is no
 * subscription lapse to hang a teardown on. Time since last use is the only
 * signal, and neither store carried a timestamp: an account that went quiet a
 * year ago looked exactly like one used this morning.
 *
 * The body also carries whether this account currently pays for investing, so
 * the pruning job can exempt subscribers. Somebody paying for Investing Plus
 * or Pro keeps their brokerage however long they stay away; only unpaid and
 * unused connections are pruned, which is the only case that is pure cost.
 * The flag is a hint for cost control and nothing else. It never grants access
 * to anything, so a client sending `true` gains nothing but its own bill.
 *
 * Bank connections are NOT tracked for pruning. They end when the subscription
 * that paid for them ends, which the app handles the moment it sees the
 * entitlement go. A Budgeting Plus subscriber who has not opened the app for
 * six weeks is still paying, and disconnecting their bank on a timer would be
 * wrong. `last_seen_at` is still stamped on plaid_items for support and
 * debugging; nothing acts on it.
 *
 * Deliberately cheap and quiet: two column touches and a 204. A failure must
 * never interrupt a launch, so this returns 204 even when the columns are
 * missing.
 */
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
    const appUserId = await verifiedAppUserId(req)
    if (!appUserId) return new NextResponse(null, { status: 204 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceRole) return new NextResponse(null, { status: 204 })

    let hasInvesting = false
    try {
        const body = await req.json()
        hasInvesting = body?.hasInvesting === true
    } catch {
        // No body is fine. Absent means "not claiming a subscription", which
        // is the direction that costs the user nothing and us a little.
    }

    const admin = createClient(url, serviceRole, {
        auth: { autoRefreshToken: false, persistSession: false },
    })
    const now = new Date().toISOString()

    // Both ignored on failure. Before last_seen.sql has been run these columns
    // do not exist; the pruning job independently refuses to run without them.
    await Promise.allSettled([
        admin
            .from("snaptrade_users")
            .update({ last_seen_at: now, has_investing: hasInvesting })
            .eq("user_id", appUserId),
        admin.from("plaid_items").update({ last_seen_at: now }).eq("user_id", appUserId),
    ])
    return new NextResponse(null, { status: 204 })
}
