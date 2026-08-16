import { NextResponse } from "next/server"
import { CountryCode, Products } from "plaid"
import { getPlaidClient, isPlaidConfigured } from "@/lib/plaid"

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

    try {
        const client = getPlaidClient()
        const response = await client.linkTokenCreate({
            user: { client_user_id: `finnacalc-${Date.now()}` },
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
