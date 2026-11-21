import { documentedMinimum } from "./snaptrade-broker-policy"
import { productBelow } from "./exact-decimal"
import { sizingInstrument } from "./snaptrade-order-capabilities"
import { reviewStorageVersion } from "./snaptrade-order-reviews"
import { fractionalRegionVerified, fundingModeEligible, MINIMUM_SOURCES, MINOR_UNITS, routeListing, routeSupport } from "./snaptrade-route-policy"
import { fractionalPrecision, notionalCents, TradingError, type ownedTradingAccount, type Terms } from "./snaptrade-trading"

type Context = Awaited<ReturnType<typeof ownedTradingAccount>>
type Mode = "shares" | "dollars"
type Action = "BUY" | "SELL"

/** A bound is either enforced by FinnaCalc ("application") or a broker rule
 * with a public source ("broker_documented", https url required). Unknown
 * bounds are null: the contract never invents a minimum. */
export type BoundV2 = { value: string; source: "application" | "broker_documented"; url?: string }
export type RuleV2 = { amountMode: Mode; action: Action; orderType: "Market" | "Limit"; timeInForce: "Day" | "GTC";
    quantityPrecision: number; minimum: BoundV2 | null; maximum: BoundV2 | null; fractionalMinimum?: BoundV2 | null }
export type DenialCode = "currency_not_reviewed" | "sizing_mode_not_supported" | "route_evidence_unverified"
    | "mode_not_enabled" | "account_product_unverified" | "instrument_tradeability_unconfirmed" | "storage_upgrade_required"
    | "fractional_account_region_unverified"
export type SizingCapabilitiesV2 = { version: 2; accountId: string; symbol: string; currency: string; minorUnit: number;
    rules: RuleV2[]; denials: Array<{ amountMode: Mode; code: DenialCode }> }
export type CashSnapshot = { accountId: string; currency: string; cash: number | null }

/** A minimum is broker_documented only when it equals the documented value
 * and a public source exists; any other configured value is FinnaCalc's own. */
export function minimumBound(slug: string, value: string): BoundV2 {
    const url = MINIMUM_SOURCES[slug]
    return url && documentedMinimum(slug) === value ? { value, source: "broker_documented", url } : { value, source: "application" }
}

/** Account- and listing-bound V2 sizing rules. Every rule is an exact
 * (mode, side, order type, time in force) combination; Dollars eligibility is
 * computed separately from fractional quantity eligibility. */
export async function sizingCapabilitiesV2(context: Context, clientId: string, q: any, { fresh }: { fresh: boolean }): Promise<SizingCapabilitiesV2> {
    const slug = context.connection.brokerage?.slug ?? ""
    const route = routeSupport(slug)
    const currency: string = q?.symbol?.currency?.code ?? ""
    const minorUnit = MINOR_UNITS[currency]
    const base = { version: 2 as const, accountId: context.account.id, symbol: String(q?.symbol?.symbol ?? "").toUpperCase(), currency, minorUnit: minorUnit ?? 0 }
    if (!route || minorUnit === undefined || !routeListing(slug, currency, q?.symbol?.exchange?.mic_code))
        return { ...base, rules: [], denials: [{ amountMode: "shares", code: "currency_not_reviewed" }, { amountMode: "dollars", code: "currency_not_reviewed" }] }

    const { cap, account } = context
    const denials: SizingCapabilitiesV2["denials"] = []
    const accountOk = fundingModeEligible(slug, account) && account.is_paper === route.paper
    let instrument: boolean | null = null
    const instrumentOk = async (): Promise<boolean> => {
        if (instrument === null) {
            try { instrument = await sizingInstrument(context, clientId, q, fresh) === true } catch { instrument = false }
        }
        return instrument
    }

    // Fractional quantity (Shares, Market/Day only).
    let decimals = 0
    if (!route.fractional) {
        if (route.unverified.includes("fractional")) denials.push({ amountMode: "shares", code: "route_evidence_unverified" })
    } else if (!cap.fractionalOrders || !cap.preview) denials.push({ amountMode: "shares", code: "mode_not_enabled" })
    else if (!accountOk) denials.push({ amountMode: "shares", code: "account_product_unverified" })
    else if (!fractionalRegionVerified(route, account)) denials.push({ amountMode: "shares", code: "fractional_account_region_unverified" })
    else if (!await instrumentOk()) denials.push({ amountMode: "shares", code: "instrument_tradeability_unconfirmed" })
    else decimals = cap.fractionalOrders.decimalPlaces
    const fractionalMinimum = decimals > 0 && cap.fractionalOrders?.minOrderValue ? minimumBound(slug, cap.fractionalOrders.minOrderValue) : null

    const rules: RuleV2[] = []
    const actions: Action[] = ["BUY", "SELL"]
    const shareCombos: Array<[RuleV2["orderType"], RuleV2["timeInForce"]]> = []
    if (cap.orderTypes.includes("Market") && cap.timeInForce.includes("Day")) shareCombos.push(["Market", "Day"])
    if (cap.orderTypes.includes("Limit") && route.limit)
        for (const tif of ["Day", "GTC"] as const) if (cap.timeInForce.includes(tif) && (tif === "Day" || route.gtc)) shareCombos.push(["Limit", tif])
    for (const action of actions) for (const [orderType, timeInForce] of shareCombos) {
        const fractional = orderType === "Market" && timeInForce === "Day" && decimals > 0
        rules.push({ amountMode: "shares", action, orderType, timeInForce, quantityPrecision: fractional ? decimals : 0,
            minimum: null, maximum: null, ...(fractional ? { fractionalMinimum } : {}) })
    }

    // Dollars (notional): Market/Day, exact 2-place amount, never inferred
    // from fractional support. V4 storage bounds dollars to 1.00–10,000.00.
    const notional = cap.notional
    let dollars = false
    if (!route.dollars) denials.push({ amountMode: "dollars", code: route.unverified.includes("dollars") ? "route_evidence_unverified" : "sizing_mode_not_supported" })
    else if (!notional || !cap.preview || minorUnit !== 2) denials.push({ amountMode: "dollars", code: "mode_not_enabled" })
    else if (!accountOk || route.selfDirectedRawTypes && !(typeof account.raw_type === "string" && cap.selfDirectedRawTypes?.includes(account.raw_type)))
        denials.push({ amountMode: "dollars", code: "account_product_unverified" })
    else if (await reviewStorageVersion().catch(() => null) !== 4) denials.push({ amountMode: "dollars", code: "storage_upgrade_required" })
    // Dollars listing proof is independent of fractional-unit metadata where
    // the route says so: the account quote's own universal id/MIC/currency
    // (already route-checked) binds the listing, and the required checked
    // preview must echo that same id before any review is stored.
    else if (route.notionalListing === "account_quote"
        ? !(typeof q?.symbol?.id === "string" && q.symbol.id.trim().length > 0)
        : !await instrumentOk()) denials.push({ amountMode: "dollars", code: "instrument_tradeability_unconfirmed" })
    else dollars = true
    if (dollars && notional) for (const action of actions)
        rules.push({ amountMode: "dollars", action, orderType: "Market", timeInForce: "Day", quantityPrecision: 0,
            minimum: minimumBound(slug, notional.minAmount), maximum: { value: notional.maxAmount, source: "application" } })
    return { ...base, rules, denials }
}

/** Server-side enforcement for a V2 order: the exact rule must exist for this
 * owned account and listing now, and the amount must satisfy it. */
export async function requireSizingV2(context: Context, clientId: string, q: any, order: Terms, options: { fresh: boolean }): Promise<RuleV2> {
    const caps = await sizingCapabilitiesV2(context, clientId, q, options)
    const dollars = order.amountMode === "dollars"
    const unavailable = () => new TradingError(dollars ? "dollar_orders_unavailable" : "sizing_rule_unavailable",
        dollars ? "Dollar orders could not be confirmed for this account and security. You can still order in shares."
            : "These order terms could not be confirmed for this account and security. Review the quantity and order type.", 409)
    if (order.sizingVersion !== 2 || order.currency !== caps.currency || order.minorUnit !== caps.minorUnit
        || order.accountId !== caps.accountId || order.symbol !== caps.symbol) throw unavailable()
    const matches = caps.rules.filter(r => r.amountMode === order.amountMode && r.action === order.action
        && r.orderType === order.orderType && r.timeInForce === order.timeInForce)
    if (matches.length !== 1) throw unavailable()
    const rule = matches[0]
    if (dollars) {
        const cents = notionalCents(order.notionalValue)
        if (cents == null || rule.minimum && cents < notionalCents(rule.minimum.value)!
            || rule.maximum && cents > notionalCents(rule.maximum.value)!) throw unavailable()
        return rule
    }
    if (order.units == null || !fractionalPrecision(order.units, rule.quantityPrecision)) throw unavailable()
    if (!Number.isInteger(order.units) && rule.fractionalMinimum) {
        const price = order.action === "BUY" ? q.ask_price : q.bid_price
        if (!(typeof price === "number" && Number.isFinite(price) && price > 0)
            || productBelow(order.units, price, rule.fractionalMinimum.value))
            throw new TradingError("order_invalid", `Fractional orders require at least ${rule.fractionalMinimum.value} ${caps.currency} in estimated value.`)
    }
    return rule
}

/** Cash for the listing currency in this same account, or null when the
 * balance is missing, ambiguous or not a finite non-negative number. */
export async function cashSnapshot(context: Context, currency: string): Promise<CashSnapshot> {
    let cash: number | null = null
    try {
        const { data } = await context.st.accountInformation.getUserAccountBalance({ ...context.auth, accountId: context.account.id })
        const rows = Array.isArray(data) ? data.filter((b: any) => b?.currency?.code === currency) : []
        const value = rows.length === 1 ? rows[0].cash : null
        cash = typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null
    } catch { cash = null }
    return { accountId: context.account.id, currency, cash }
}
export { productBelow }
