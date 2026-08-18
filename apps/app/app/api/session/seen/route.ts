import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifiedAppUserId } from "@/lib/supabase-auth"

/**
 * "I am still here." Called by the app on launch.
 *
 * Plaid bills per linked Item and SnapTrade per connected user, monthly,
 * whether or not anyone opens the app. Neither table carried a timestamp, so
 * an account that went quiet a year ago looked exactly like one used this
 * morning and kept costing money. This is the signal the pruning job reads.
 *
 * Deliberately cheap and deliberately quiet: it touches two columns and
 * returns 204. A failure here must never interrupt a launch, so the caller
 * ignores the result and this returns 204 even when the column is missing.
 */
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
    const appUserId = await verifiedAppUserId(req)
    if (!appUserId) return new NextResponse(null, { status: 204 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceRole) return new NextResponse(null, { status: 204 })

    const admin = createClient(url, serviceRole, {
        auth: { autoRefreshToken: false, persistSession: false },
    })
    const now = new Date().toISOString()

    // Both tables, both ignored on failure. Before last_seen.sql has been run
    // the column does not exist and these fail; that is fine, and the pruning
    // job independently refuses to run without the column.
    await Promise.allSettled([
        admin.from("snaptrade_users").update({ last_seen_at: now }).eq("user_id", appUserId),
        admin.from("plaid_items").update({ last_seen_at: now }).eq("user_id", appUserId),
    ])
    return new NextResponse(null, { status: 204 })
}
