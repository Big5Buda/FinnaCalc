import { NextRequest, NextResponse } from "next/server"
import { verifiedAppUserId } from "@/lib/supabase-auth"
import { AppleSubscriptionError, verifySubmittedTransactions } from "@/lib/apple-subscriptions"
import { synchronizeAppleAccount } from "@/lib/apple-entitlement-store"

export const runtime = "nodejs"
export async function POST(req: NextRequest) {
    const userId = await verifiedAppUserId(req)
    if (!userId) return NextResponse.json({ error: "Sign in to activate your subscription." }, { status: 401 })
    try {
        const body = await req.json()
        if (!Array.isArray(body?.transactions)) return NextResponse.json({ error: "Purchase proofs are required." }, { status: 400 })
        const submitted = await verifySubmittedTransactions(body.transactions)
        const { grants, purchaseError } = await synchronizeAppleAccount(userId, submitted, body.claimLegacyPurchases === true)
        const tiers = new Set(grants.map((grant) => grant.tier))
        const tier = tiers.has("pro") ? "pro"
            : tiers.has("trader") ? "trader" : tiers.has("plus") ? "plus" : null
        return NextResponse.json({ active: tier != null, tier, ...(purchaseError ? { purchaseError } : {}) })
    } catch (error) {
        if (error instanceof AppleSubscriptionError) {
            const code = error.message.startsWith("Confirm linking") ? "legacy_claim_required"
                : error.status === 409 ? "purchase_owned_by_another_account" : "verification_unavailable"
            return NextResponse.json({ error: error.message, code }, { status: error.status })
        }
        return NextResponse.json({ error: "Subscription verification could not be completed." }, { status: 400 })
    }
}
