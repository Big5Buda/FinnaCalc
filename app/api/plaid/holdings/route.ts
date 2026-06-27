import { NextResponse } from "next/server"
import { getPlaidClient, isPlaidConfigured } from "@/lib/plaid"

export interface PortfolioHolding {
    securityId: string
    name: string        // ticker or short name (chart label)
    fullName: string    // full security name
    type: string        // equity | etf | mutual fund | cash | fixed income | ...
    value: number       // market value in account currency
    quantity: number
    price: number       // current price per share
    avgCost: number     // average cost per share
    costBasis: number   // total cost basis
    totalReturn: number // value - costBasis
    totalReturnPct: number | null
    weight: number      // % of portfolio
}

export interface AllocationSlice {
    type: string
    value: number
}

export interface PortfolioResponse {
    holdings: PortfolioHolding[]
    allocation: AllocationSlice[]
    totalValue: number
    totalCostBasis: number
    totalReturn: number
    totalReturnPct: number | null
    accountCount: number
    currency: string
}

function titleCase(s: string) {
    return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

export async function POST(req: Request) {
    if (!isPlaidConfigured()) {
        return NextResponse.json(
            { error: "Portfolio import is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to your environment variables." },
            { status: 503 }
        )
    }

    let body: { public_token?: string }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
    }

    if (!body.public_token) {
        return NextResponse.json({ error: "public_token is required." }, { status: 400 })
    }

    try {
        const client = getPlaidClient()

        // Exchange the short-lived public token for an access token.
        const exchange = await client.itemPublicTokenExchange({ public_token: body.public_token })
        const accessToken = exchange.data.access_token

        // Pull investment holdings + the securities that describe them.
        const { data } = await client.investmentsHoldingsGet({ access_token: accessToken })
        const { holdings, securities, accounts } = data

        const securityById = new Map(securities.map((s) => [s.security_id, s]))

        const round2 = (n: number) => Math.round(n * 100) / 100

        const preliminary = holdings
            .map((h) => {
                const sec = securityById.get(h.security_id)
                const price = h.institution_price ?? sec?.close_price ?? 0
                const value = h.institution_value ?? h.quantity * price
                // Plaid cost_basis is the total cost basis for the holding.
                const costBasis = (h as any).cost_basis != null ? (h as any).cost_basis : value
                const avgCost = h.quantity > 0 ? costBasis / h.quantity : price
                const totalReturn = value - costBasis
                return {
                    securityId: h.security_id,
                    name: sec?.ticker_symbol || sec?.name || "Unknown",
                    fullName: sec?.name || sec?.ticker_symbol || "Unknown security",
                    type: sec?.type ? titleCase(String(sec.type)) : "Other",
                    value: round2(value),
                    quantity: h.quantity,
                    price: round2(price),
                    avgCost: round2(avgCost),
                    costBasis: round2(costBasis),
                    totalReturn: round2(totalReturn),
                    totalReturnPct: costBasis > 0 ? round2((totalReturn / costBasis) * 100) : null,
                }
            })
            .filter((h) => h.value > 0)
            .sort((a, b) => b.value - a.value)

        const totalValue = round2(preliminary.reduce((sum, h) => sum + h.value, 0))

        const mapped: PortfolioHolding[] = preliminary.map((h) => ({
            ...h,
            weight: totalValue > 0 ? round2((h.value / totalValue) * 100) : 0,
        }))

        // Asset allocation by security type.
        const allocationMap = new Map<string, number>()
        for (const h of mapped) {
            allocationMap.set(h.type, (allocationMap.get(h.type) ?? 0) + h.value)
        }
        const allocation: AllocationSlice[] = Array.from(allocationMap.entries())
            .map(([type, value]) => ({ type, value: round2(value) }))
            .sort((a, b) => b.value - a.value)

        const totalCostBasis = round2(mapped.reduce((sum, h) => sum + h.costBasis, 0))
        const totalReturn = round2(totalValue - totalCostBasis)
        const currency =
            accounts[0]?.balances?.iso_currency_code ||
            securities[0]?.iso_currency_code ||
            "USD"

        const result: PortfolioResponse = {
            holdings: mapped,
            allocation,
            totalValue,
            totalCostBasis,
            totalReturn,
            totalReturnPct: totalCostBasis > 0 ? round2((totalReturn / totalCostBasis) * 100) : null,
            accountCount: accounts.length,
            currency,
        }
        return NextResponse.json(result)
    } catch (err: any) {
        const message =
            err?.response?.data?.error_message || err?.message || "Failed to load portfolio holdings."
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
