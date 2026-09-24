import { NextRequest, NextResponse } from "next/server"
import { verifiedAppUserId } from "@/lib/supabase-auth"
import { isPlaidConfigured } from "@/lib/plaid"
import { paidFeatureError } from "@/lib/paid-feature-access"
import { bankConnectionAllowance, INCLUDED_BANK_CONNECTIONS } from "@/lib/bank-allowance"
import { loadItems } from "@/lib/plaid-items"

/**
 * The banks this account has linked, and how many it may hold.
 *
 * Disconnecting ONE bank has been possible since the disconnect route was
 * written: it takes an item id. Nothing could call it, because no route ever
 * told the app what the item ids were, so the only thing the app could offer
 * was all or nothing. This is the missing half.
 *
 * Access tokens are the long-lived credential for a bank login and never
 * leave the server; this returns the id and the institution name and nothing
 * else.
 *
 * GET -> 200 {
 *   connections: [{ itemId, institution, linkedAt, includedInPlan }],
 *   allowance, included
 * }
 */
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
    if (!isPlaidConfigured()) {
        return NextResponse.json({ error: "Bank connections aren't configured." }, { status: 503 })
    }
    const userId = await verifiedAppUserId(req)
    const accessError = await paidFeatureError(userId, "budgeting")
    if (accessError) return accessError
    try {
        const [items, allowance] = await Promise.all([loadItems(userId!), bankConnectionAllowance(userId!)])
        return NextResponse.json({
            // Oldest first. Anything past the included two is what an
            // add-on is paying for, which is the only honest way to answer
            // "which bank is the extra one".
            connections: items.map((item, index) => ({
                itemId: item.itemId,
                institution: item.institution,
                linkedAt: item.linkedAt ?? null,
                includedInPlan: index < INCLUDED_BANK_CONNECTIONS,
            })),
            allowance,
            included: INCLUDED_BANK_CONNECTIONS,
        })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || "Bank connections couldn't be read." }, { status: 500 })
    }
}
