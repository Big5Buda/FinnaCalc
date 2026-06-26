import { NextResponse } from "next/server"
import { CountryCode, Products } from "plaid"
import { getPlaidClient, isPlaidConfigured } from "@/lib/plaid"

export async function POST() {
    if (!isPlaidConfigured()) {
        return NextResponse.json(
            { error: "Portfolio import is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to your environment variables." },
            { status: 503 }
        )
    }

    try {
        const client = getPlaidClient()
        const response = await client.linkTokenCreate({
            user: { client_user_id: `finnacalc-${Date.now()}` },
            client_name: "FinnaCalc",
            products: [Products.Investments],
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
