import { verifiedAppUserId } from "@/lib/supabase-auth"
import { paidFeatureError } from "@/lib/paid-feature-access"
import { NextResponse } from "next/server"
import { CountryCode, Products } from "plaid"
import { getPlaidClient, isPlaidConfigured } from "@/lib/plaid"
import { bankConnectionAllowance } from "@/lib/bank-allowance"
import { BankConnectionLimitError, loadItems } from "@/lib/plaid-items"

// Each feature links its own Item with just the product it needs.
const PRODUCT_MAP: Record<string, Products> = {
    investments: Products.Investments,
    liabilities: Products.Liabilities,
    transactions: Products.Transactions,
}

export async function POST(req: Request) {
    if (!isPlaidConfigured()) {
        return NextResponse.json(
            { error: "Bank connection is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to your environment variables." },
            { status: 503 }
        )
    }

    // Default to investments so the existing portfolio card (which posts no
    // body) keeps working unchanged.
    let product = "investments"
    try {
        const body = await req.json()
        if (body?.product && PRODUCT_MAP[body.product]) product = body.product
    } catch {
        /* no body → keep default */
    }

    const userId = await verifiedAppUserId(req)
    const accessError = await paidFeatureError(userId, product === "investments" ? "investing" : "budgeting")
    if (accessError) return accessError

    try {
        if (product !== "investments") {
            const [items, allowance] = await Promise.all([loadItems(userId!), bankConnectionAllowance(userId!)])
            if (items.length >= allowance) {
                // The code, not the sentence, is what the app branches on.
                // Both the limit and a connection owned by another account
                // answer 409, and telling them apart by message text is how
                // an app ends up offering to sell an add-on to somebody
                // whose problem was something else entirely.
                return NextResponse.json({
                    error: new BankConnectionLimitError(allowance).message,
                    code: "bank_connection_limit_reached",
                    allowance,
                    connected: items.length,
                }, { status: 409 })
            }
        }
        const client = getPlaidClient()
        const response = await client.linkTokenCreate({
            user: { client_user_id: userId! },
            client_name: "FinnaCalc",
            products: [PRODUCT_MAP[product]],
            country_codes: [CountryCode.Us],
            language: "en",
        })
        return NextResponse.json({ link_token: response.data.link_token })
    } catch (err: any) {
        const message =
            err?.response?.data?.error_message || err?.message || "Failed to create link token."
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
