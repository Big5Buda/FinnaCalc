import { brokerageInstrument } from "./snaptrade-brokerage-instruments"
import { reviewStorageVersion } from "./snaptrade-order-reviews"
import { NOTIONAL_BROKERAGES, TradingError, type NotionalCapability, type ownedTradingAccount } from "./snaptrade-trading"

type Context = Awaited<ReturnType<typeof ownedTradingAccount>>

/** Dollar (notional) orders are offered only when EVERY condition holds:
 * code allowlist (ALPACA-PAPER), reviewed env `notional` block, provider
 * preview required, paper + brokerage-confirmed cash account, USD listing,
 * order storage V4, and exactly-bound instrument metadata that is both
 * tradeable and fractionable. Any failure or doubt → null (dollars hidden).
 * Client-supplied capability claims are never consulted. */
export async function dollarEligibility(context: Context, clientId: string, q: any,
    { fresh }: { fresh: boolean }): Promise<NotionalCapability | null> {
    try {
        const slug = context.connection.brokerage?.slug ?? ""
        const notional = context.cap.notional
        if (!NOTIONAL_BROKERAGES.includes(slug) || !notional || context.cap.preview !== true
            || context.account.is_paper !== true || context.account.cash_or_margin !== "cash"
            || q?.symbol?.currency?.code !== "USD" || typeof q.symbol.id !== "string") return null
        if (await reviewStorageVersion() !== 4) return null
        const facts = await brokerageInstrument(clientId, slug,
            { symbol: q.symbol.symbol, mic: q.symbol.exchange?.mic_code ?? null, id: q.symbol.id }, { fresh })
        return facts?.tradeable === true && facts.fractionable === true ? notional : null
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
    | { amountMode: "shares"; fractional: boolean; actions: Array<"BUY" | "SELL">; orderTypes: Partial<Record<"Market" | "Limit", Array<"Day" | "GTC">>>; previewRequired: boolean }
    | { amountMode: "dollars"; actions: Array<"BUY" | "SELL">; orderTypes: { Market: ["Day"] }; minAmount: string; maxAmount: string; decimalPlaces: 2; previewRequired: true }> }

export function orderCapabilities(context: Context, currency: string, dollars: NotionalCapability | null): OrderCapabilities {
    const { cap } = context
    const orderTypes: Partial<Record<"Market" | "Limit", Array<"Day" | "GTC">>> = {}
    if (cap.orderTypes.includes("Market") && cap.timeInForce.includes("Day")) orderTypes.Market = ["Day"]
    if (cap.orderTypes.includes("Limit")) {
        const tifs = (["Day", "GTC"] as const).filter(t => cap.timeInForce.includes(t))
        if (tifs.length) orderTypes.Limit = [...tifs]
    }
    return { version: 1, currency, rules: [
        { amountMode: "shares", fractional: cap.fractional && context.connection.brokerage?.allows_fractional_units === true,
            actions: ["BUY", "SELL"], orderTypes, previewRequired: cap.preview },
        ...(dollars ? [{ amountMode: "dollars" as const, actions: ["BUY", "SELL"] as Array<"BUY" | "SELL">,
            orderTypes: { Market: ["Day"] as ["Day"] }, minAmount: dollars.minAmount, maxAmount: dollars.maxAmount,
            decimalPlaces: 2 as const, previewRequired: true as const }] : []),
    ] }
}
