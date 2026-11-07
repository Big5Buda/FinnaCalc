import { usEquitySupport, previewOnlyInstruments } from "./snaptrade-broker-policy"
import { brokerageInstrument, previewOnlyInstrumentEligibility } from "./snaptrade-brokerage-instruments"
import { reviewStorageVersion } from "./snaptrade-order-reviews"
import { NOTIONAL_BROKERAGES, fractionalPrecision, TradingError, type NotionalCapability, type ownedTradingAccount } from "./snaptrade-trading"

type Context = Awaited<ReturnType<typeof ownedTradingAccount>>

async function sizingInstrument(context: Context, clientId: string, q: any, fresh: boolean): Promise<boolean> {
    const slug = context.connection.brokerage?.slug ?? ""
    const listing = { symbol: q?.symbol?.symbol, mic: q?.symbol?.exchange?.mic_code ?? null, id: q?.symbol?.id }
    if (!listing.symbol || !listing.mic || !listing.id) return false
    if (previewOnlyInstruments(slug)) return previewOnlyInstrumentEligibility(clientId, slug, listing)
    const facts = await brokerageInstrument(clientId, slug, listing, { fresh })
    return facts?.tradeable === true && facts.fractionable === true
}
export async function fractionalEligibility(context: Context, clientId: string, q: any, { fresh }: { fresh: boolean }) {
    if (!context.cap.preview || !context.cap.fractionalOrders || context.account.cash_or_margin !== "cash"
        || context.account.is_paper !== usEquitySupport(context.connection.brokerage?.slug ?? "")?.paper
        || q?.symbol?.currency?.code !== "USD") return null
    return await sizingInstrument(context, clientId, q, fresh) ? context.cap.fractionalOrders : null
}
export async function requireFractionalEligibility(context: Context, clientId: string, q: any, order: import("./snaptrade-trading").Terms, options: { fresh: boolean }) {
    if (order.amountMode !== "shares" || Number.isInteger(order.units)) return
    const cap = await fractionalEligibility(context, clientId, q, options)
    if (!cap || order.orderType !== "Market" || order.timeInForce !== "Day" || order.units == null
        || !fractionalPrecision(order.units, cap.decimalPlaces))
        throw new TradingError("fractional_orders_unavailable", "These fractional order terms could not be confirmed. Review the quantity and order type.", 409)
    if (cap.minOrderValue) {
        const price = order.action === "BUY" ? q.ask_price : q.bid_price
        if (!(typeof price === "number" && Number.isFinite(price) && price > 0)
            || order.units * price < Number(cap.minOrderValue))
            throw new TradingError("order_invalid", `Fractional orders require at least $${cap.minOrderValue} in estimated value.`)
    }
}

/** Dollar (notional) orders are offered only when EVERY condition holds:
 * reviewed US institution sizing support, reviewed env `notional` block, provider
 * preview required, brokerage-confirmed cash account and matching paper/live environment, USD listing,
 * order storage V4, and positive exact instrument metadata or an explicitly
 * reviewed preview-only institution with a valid unsupported response. The
 * exact order must still receive a checked trade ID before any placement.
 * Client-supplied capability claims are never consulted. */
export async function dollarEligibility(context: Context, clientId: string, q: any,
    { fresh }: { fresh: boolean }): Promise<NotionalCapability | null> {
    try {
        const slug = context.connection.brokerage?.slug ?? ""
        const notional = context.cap.notional
        if (!NOTIONAL_BROKERAGES.includes(slug) || !notional || context.cap.preview !== true
            || context.account.is_paper !== usEquitySupport(slug)?.paper || context.account.cash_or_margin !== "cash"
            || q?.symbol?.currency?.code !== "USD" || typeof q.symbol.id !== "string") return null
        if (await reviewStorageVersion() !== 4) return null
        return await sizingInstrument(context, clientId, q, fresh) ? notional : null
    } catch { return null }
}
export async function requireDollarEligibility(context: Context, clientId: string, q: any, options: { fresh: boolean }) {
    const notional = await dollarEligibility(context, clientId, q, options)
    if (!notional) throw new TradingError("dollar_orders_unavailable",
        "Dollar orders could not be confirmed for this account and security. You can still order in shares.", 409)
    return notional
}

/** Additive quote field, version 1. Rules list only valid combinations
 * (order type → allowed time-in-force), never a free cross-product. */
export type OrderCapabilities = { version: 1; currency: string; rules: Array<
    | { amountMode: "shares"; fractional: boolean; actions: Array<"BUY" | "SELL">; orderTypes: Partial<Record<"Market" | "Limit", Array<"Day" | "GTC">>>; previewRequired: boolean; fractionalOrderTypes?: { Market: ["Day"] }; fractionalDecimalPlaces?: number; fractionalMinOrderValue?: string; fractionalAvailability?: "broker_confirmed_at_review" }
    | { amountMode: "dollars"; actions: Array<"BUY" | "SELL">; orderTypes: { Market: ["Day"] }; minAmount: string; maxAmount: string; decimalPlaces: 2; previewRequired: true; availability?: "broker_confirmed_at_review" }> }

export function orderCapabilities(context: Context, currency: string, dollars: NotionalCapability | null, fractional: import("./snaptrade-trading").FractionalCapability | null = null): OrderCapabilities {
    const { cap } = context
    const orderTypes: Partial<Record<"Market" | "Limit", Array<"Day" | "GTC">>> = {}
    if (cap.orderTypes.includes("Market") && cap.timeInForce.includes("Day")) orderTypes.Market = ["Day"]
    if (cap.orderTypes.includes("Limit")) {
        const tifs = (["Day", "GTC"] as const).filter(t => cap.timeInForce.includes(t))
        if (tifs.length) orderTypes.Limit = [...tifs]
    }
    return { version: 1, currency, rules: [
        { amountMode: "shares", fractional: false,
            ...(fractional ? { fractionalOrderTypes: fractional.orderTypes, fractionalDecimalPlaces: fractional.decimalPlaces,
                ...(fractional.minOrderValue ? { fractionalMinOrderValue: fractional.minOrderValue } : {}), fractionalAvailability: "broker_confirmed_at_review" as const } : {}),
            actions: ["BUY", "SELL"], orderTypes, previewRequired: cap.preview },
        ...(dollars ? [{ amountMode: "dollars" as const, actions: ["BUY", "SELL"] as Array<"BUY" | "SELL">,
            orderTypes: { Market: ["Day"] as ["Day"] }, minAmount: dollars.minAmount, maxAmount: dollars.maxAmount,
            decimalPlaces: 2 as const, previewRequired: true as const, ...(previewOnlyInstruments(context.connection.brokerage?.slug ?? "") ? { availability: "broker_confirmed_at_review" as const } : {}) }] : []),
    ] }
}
