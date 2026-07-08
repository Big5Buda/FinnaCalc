import { NextRequest, NextResponse } from "next/server"
import { getSnapTrade, isSnapTradeConfigured, snapTradeErrorMessage } from "@/lib/snaptrade"
import { loadSession } from "@/lib/snaptrade-session"
import { verifiedAppUserId } from "@/lib/supabase-auth"

const ACTIONS = ["BUY", "SELL"] as const
const ORDER_TYPES = ["Market", "Limit", "Stop", "StopLimit"] as const
const TIME_IN_FORCE = ["Day", "GTC", "FOK", "IOC"] as const

// Step 1 of SnapTrade's two-step order flow: validate the order against the
// brokerage and get its impact (estimated commission, remaining cash) plus a
// tradeId. Nothing is executed here — the client shows this as the Review
// screen, then confirms via /api/snaptrade/trade/place with the tradeId.
export async function POST(req: NextRequest) {
    if (!isSnapTradeConfigured) {
        return NextResponse.json({ error: "Brokerage connection isn't configured." }, { status: 503 })
    }
    // Trading requires a signed-in FinnaCalc user — SnapTrade credentials
    // live server-side keyed to the Supabase user, never on the client.
    const appUserId = await verifiedAppUserId(req)
    if (!appUserId) {
        return NextResponse.json({ error: "Sign in to FinnaCalc to trade." }, { status: 401 })
    }

    let body: any
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
    }

    const accountId = typeof body.accountId === "string" ? body.accountId.trim() : ""
    const symbol = typeof body.symbol === "string" ? body.symbol.trim().toUpperCase() : ""
    const action = body.action
    const orderType = body.orderType
    const timeInForce = body.timeInForce
    const units = typeof body.units === "number" ? body.units : NaN
    const price = body.price == null ? null : typeof body.price === "number" ? body.price : NaN
    const stop = body.stop == null ? null : typeof body.stop === "number" ? body.stop : NaN

    if (!accountId || !symbol) {
        return NextResponse.json({ error: "accountId and symbol are required." }, { status: 400 })
    }
    if (!ACTIONS.includes(action)) {
        return NextResponse.json({ error: "action must be BUY or SELL." }, { status: 400 })
    }
    if (!ORDER_TYPES.includes(orderType)) {
        return NextResponse.json({ error: "Unsupported order type." }, { status: 400 })
    }
    if (!TIME_IN_FORCE.includes(timeInForce)) {
        return NextResponse.json({ error: "Unsupported time in force." }, { status: 400 })
    }
    if (!Number.isFinite(units) || units <= 0) {
        return NextResponse.json({ error: "units must be a positive number." }, { status: 400 })
    }
    if ((orderType === "Limit" || orderType === "StopLimit") && (price == null || !Number.isFinite(price) || price <= 0)) {
        return NextResponse.json({ error: "A positive limit price is required for limit orders." }, { status: 400 })
    }
    if ((orderType === "Stop" || orderType === "StopLimit") && (stop == null || !Number.isFinite(stop) || stop <= 0)) {
        return NextResponse.json({ error: "A positive stop price is required for stop orders." }, { status: 400 })
    }

    try {
        const session = await loadSession(appUserId)
        if (!session) {
            return NextResponse.json({ error: "No brokerage connection." }, { status: 401 })
        }
        const st = getSnapTrade()

        // Orders take a universal_symbol_id, not a ticker — resolve it within
        // this account so we only match symbols this brokerage can trade.
        const search = await st.referenceData.symbolSearchUserAccount({
            userId: session.userId,
            userSecret: session.userSecret,
            accountId,
            substring: symbol,
        })
        const matches = Array.isArray(search.data) ? search.data : []
        // Prefer exact `symbol` matches; fall back to raw_symbol (SnapTrade
        // strips the exchange suffix there, e.g. "VAB.TO" → raw "VAB").
        const bySymbol = matches.filter((s: any) => s?.symbol?.toUpperCase() === symbol)
        let candidates: any[] = bySymbol.length
            ? bySymbol
            : matches.filter((s: any) => s?.raw_symbol?.toUpperCase() === symbol)

        // Cross-listed tickers (NYSE + TSX etc.) return several exact matches;
        // silently taking the first could route the order to the wrong listing.
        // Tie-break by the account's own currency; if still ambiguous, refuse
        // rather than guess — this is an order, not a chart.
        if (candidates.length > 1) {
            const accountsRes = await st.accountInformation.listUserAccounts({
                userId: session.userId,
                userSecret: session.userSecret,
            })
            const accountCurrency = (Array.isArray(accountsRes.data) ? accountsRes.data : []).find(
                (a: any) => a?.id === accountId
            )?.balance?.total?.currency
            const byCurrency = candidates.filter((s: any) => s?.currency?.code === accountCurrency)
            if (byCurrency.length === 1) {
                candidates = byCurrency
            } else {
                const listings = candidates
                    .map((s: any) => [s?.exchange?.code, s?.currency?.code].filter(Boolean).join("/"))
                    .filter(Boolean)
                    .join(", ")
                return NextResponse.json(
                    { error: `${symbol} has multiple listings in this account (${listings}). Trading cross-listed symbols isn't supported yet.` },
                    { status: 400 }
                )
            }
        }
        const resolved: any = candidates[0]
        if (!resolved?.id) {
            return NextResponse.json(
                { error: `${symbol} isn't tradeable in this account.` },
                { status: 400 }
            )
        }

        const { data } = await st.trading.getOrderImpact({
            userId: session.userId,
            userSecret: session.userSecret,
            account_id: accountId,
            action,
            universal_symbol_id: resolved.id,
            order_type: orderType,
            time_in_force: timeInForce,
            units,
            price,
            stop,
        })

        const tradeId = data?.trade?.id
        if (!tradeId) {
            return NextResponse.json(
                { error: "The brokerage didn't validate this order." },
                { status: 500 }
            )
        }
        const impact: any = Array.isArray(data.trade_impacts) ? data.trade_impacts[0] : null
        return NextResponse.json({
            tradeId,
            symbol,
            action,
            units: data.trade?.units ?? units,
            price: (data.trade as any)?.price ?? price,
            estimatedCommission: impact?.estimated_commission ?? null,
            forexFees: impact?.forex_fees ?? null,
            remainingCash: impact?.remaining_cash ?? null,
            currency: impact?.currency ?? null,
            // Which listing the order will route to — shown on the Review
            // screen so cross-listed symbols are never a surprise.
            exchange: resolved.exchange?.code ?? null,
            symbolCurrency: resolved.currency?.code ?? null,
        })
    } catch (err: any) {
        return NextResponse.json(
            { error: snapTradeErrorMessage(err, "The brokerage rejected this order preview.") },
            { status: 500 }
        )
    }
}
