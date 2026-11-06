import { getSnapTrade, isTradingKeyApproved, type SnapTradeSession } from "./snaptrade"
import { brokerageReadScope } from "./snaptrade-access"
import { accountPositions, positionNumber } from "./snaptrade-positions"

export class TradingError extends Error {
    constructor(public code: string, message: string, public status = 400) { super(message) }
}
export type Terms = { accountId: string; symbol: string; action: "BUY" | "SELL"; units: number;
    orderType: "Market" | "Limit"; timeInForce: "Day" | "GTC"; price: number | null; stop: null }
export type Capability = { orderTypes: string[]; timeInForce: string[]; fractional: boolean; preview: boolean; exchanges: string[] }
export function tradingGate(clientId?: string): void {
    if (process.env.SNAPTRADE_TRADING_RELEASE_APPROVED !== "true" || !clientId || !isTradingKeyApproved(clientId))
        throw new TradingError("trading_unavailable", "Trading is not enabled for this integration.", 503)
}
export function terms(body: any): Terms {
    const fail = () => { throw new TradingError("order_invalid", "Review the account, symbol, quantity and order terms.") }
    if (!body || typeof body !== "object" || Array.isArray(body)) return fail()
    const accountId = typeof body.accountId === "string" ? body.accountId.trim() : ""
    const symbol = typeof body.symbol === "string" ? body.symbol.trim().toUpperCase() : ""
    if (!accountId || !/^[A-Z0-9][A-Z0-9.\-]{0,19}$/.test(symbol)
        || !["BUY", "SELL"].includes(body.action) || !["Market", "Limit"].includes(body.orderType)
        || !["Day", "GTC"].includes(body.timeInForce) || !Number.isFinite(body.units) || body.units <= 0
        || body.units > 1e9 || Math.abs(body.units * 1e6 - Math.round(body.units * 1e6)) > 0.0001
        || body.notionalValue != null || body.stop != null) return fail()
    if (body.orderType === "Market" && (body.price != null || body.timeInForce !== "Day")) return fail()
    if (body.orderType === "Limit" && (!Number.isFinite(body.price) || body.price <= 0 || body.price > 1e9
        || Math.abs(body.price * 1e4 - Math.round(body.price * 1e4)) > 0.0001)) return fail()
    return { accountId, symbol, action: body.action, units: body.units, orderType: body.orderType,
        timeInForce: body.timeInForce, price: body.orderType === "Limit" ? body.price : null, stop: null }
}
export function sameTerms(a: Terms, b: Terms): boolean { return JSON.stringify(terms(a)) === JSON.stringify(terms(b)) }

/** No broker is enabled by default. Values require reviewed institution/account evidence before release. */
export function capability(slug: string): Capability {
    let value: any
    try { value = JSON.parse(process.env.SNAPTRADE_TRADING_BROKER_CAPABILITIES ?? "{}")[slug] } catch { /* fail closed */ }
    if (!value || !Array.isArray(value.orderTypes) || !value.orderTypes.length
        || !value.orderTypes.every((v: unknown) => v === "Market" || v === "Limit")
        || !Array.isArray(value.timeInForce) || !value.timeInForce.length
        || !value.timeInForce.every((v: unknown) => v === "Day" || v === "GTC")
        || !Array.isArray(value.exchanges) || !value.exchanges.length
        || !value.exchanges.every((v: unknown) => typeof v === "string" && /^[A-Z0-9]{2,12}$/.test(v))
        || typeof value.fractional !== "boolean" || typeof value.preview !== "boolean")
        throw new TradingError("trading_unavailable", "Trading support for this brokerage has not been confirmed.", 503)
    return value
}
export function configuredTradingBrokerages(): string[] {
    try {
        const raw = JSON.parse(process.env.SNAPTRADE_TRADING_BROKER_CAPABILITIES ?? "{}")
        return Object.keys(raw).filter(slug => {
            if (!/^[A-Z0-9-]+$/.test(slug)) return false
            try { capability(slug); return true } catch { return false }
        })
    } catch { return [] }
}
/** Read-only live feature metadata for this user's original key, never an
 * inference from a public catalog, display name, or another key's dashboard. */
export async function liveTradingBrokerages(clientId: string): Promise<string[]> {
    const { data } = await getSnapTrade({ clientId }).referenceData.getPartnerInfo()
    if (data.can_access_trades !== true || !Array.isArray(data.allowed_brokerages)) return []
    const configured = configuredTradingBrokerages()
    return data.allowed_brokerages.flatMap(b => typeof b.slug === "string" && configured.includes(b.slug)
        && b.allows_trading === true && b.enabled === true && b.maintenance_mode === false ? [b.slug] : [])
}
export async function requireTradeConnection(clientId: string, broker: string): Promise<void> {
    tradingGate(clientId)
    if (process.env.SNAPTRADE_TRADE_CONNECTIONS_ENABLED !== "true")
        throw new TradingError("trade_connections_unavailable", "Trading authorization is not enabled for this integration.", 503)
    if (!(await liveTradingBrokerages(clientId)).includes(broker))
        throw new TradingError("broker_trading_unavailable", "Trading authorization is not available for this brokerage. You can connect for view-only access.", 409)
}
export async function ownedTradingAccount(userId: string, session: SnapTradeSession, accountId: string) {
    tradingGate(session.clientId)
    const st = getSnapTrade(session)
    const scope = await brokerageReadScope(userId, session, undefined, true)
    if ("denied" in scope) throw new TradingError("trading_access_unavailable", "Brokerage plan access could not be confirmed.", scope.denied.status)
    const auth = { userId: session.userId, userSecret: session.userSecret }
    const { data: accounts } = await st.accountInformation.listUserAccounts(auth)
    const listedAccount = Array.isArray(accounts) ? accounts.find(a => a.id === accountId) : undefined
    if (!listedAccount || typeof listedAccount.brokerage_authorization !== "string" || !listedAccount.brokerage_authorization.trim()) throw new TradingError("account_not_owned", "This account is not available for this user.", 404)
    const { data: account } = await st.accountInformation.getAccountDetails({ ...auth, accountId })
    if (!account || account.id !== accountId || typeof account.connection_id !== "string" || !account.connection_id.trim() || account.connection_id !== listedAccount.brokerage_authorization) throw new TradingError("account_not_owned", "This account is not available for this user.", 404)
    if (scope.countedConnectionId && account.connection_id !== scope.countedConnectionId)
        throw new TradingError("brokerage_connection_limit", "This brokerage is outside the plan's counted connection.", 403)
    const { data: connections } = await st.connections.listBrokerageAuthorizations(auth)
    const connection = connections.find(c => c.id === account.connection_id)
    if (!connection || connection.disabled || connection.type !== "trade")
        throw new TradingError("trading_permission_required", "Authorize trading for this brokerage before continuing.", 403)
    if (connection.brokerage?.allows_trading !== true || account.status !== "open" || account.kind !== "investment")
        throw new TradingError("trading_unavailable", "Trading eligibility for this account could not be confirmed.", 403)
    const slug = connection.brokerage.slug ?? ""
    // Current details require a boolean environment marker. For launch brokers
    // also bind that marker to the documented paper/live institution slug.
    if (typeof account.is_paper !== "boolean"
        || slug === "ALPACA-PAPER" && account.is_paper !== true
        || ["ETRADE", "ALPACA", "SCHWAB"].includes(slug) && account.is_paper !== false)
        throw new TradingError("account_environment_unverified", "The brokerage account's paper or live environment could not be confirmed.", 409)
    const cap = capability(connection.brokerage.slug ?? "")
    if (!(await liveTradingBrokerages(session.clientId)).includes(connection.brokerage.slug ?? ""))
        throw new TradingError("broker_trading_unavailable", "Trading availability could not be confirmed for this brokerage.", 503)
    return { st, auth, account, connection, cap }
}
export async function accountQuote(context: Awaited<ReturnType<typeof ownedTradingAccount>>, symbol: string) {
    const { st, auth, account, cap } = context
    let quotes: any
    try { quotes = (await st.trading.getUserAccountQuotes({ ...auth, accountId: account.id, symbols: symbol, useTicker: true })).data }
    catch { throw new TradingError("quote_unavailable", "A brokerage quote is unavailable right now.", 502) }
    const q = Array.isArray(quotes) ? quotes.find(q => q.symbol?.symbol?.toUpperCase() === symbol) : null
    if (!q?.symbol?.id) throw new TradingError("quote_unsupported", "This security could not be confirmed for this account.", 422)
    if (!["cs", "et"].includes(q.symbol.type?.code) || q.symbol.currency?.code !== "USD"
        || !cap.exchanges.includes(q.symbol.exchange?.code))
        throw new TradingError("quote_unsupported", "Trading support for this listing has not been confirmed.", 422)
    return q
}
export type ImpactFacts = { accountId: string; currencyId: string; currency: string;
    estimatedCommission: number | null; forexFees: number | null; remainingCash: number | null }
/** Impact currency is a provider UUID, not an ISO code. Resolve only through
 * the balance metadata returned for this same owned account and listing currency. */
export async function bindImpact(context: Awaited<ReturnType<typeof ownedTradingAccount>>, order: Terms, q: any, impacts: any): Promise<ImpactFacts | null> {
    const { data: balances } = await context.st.accountInformation.getUserAccountBalance({ ...context.auth, accountId: order.accountId })
    if (!Array.isArray(balances) || !Array.isArray(impacts)) return null
    const candidates = impacts.flatMap((i: any) => {
        if (i?.account !== order.accountId || typeof i.currency !== "string") return []
        const currencies = balances.filter(b => typeof b.currency?.id === "string"
            && b.currency.id === i.currency && b.currency.code === q.symbol.currency?.code)
        if (currencies.length !== 1) return []
        const number = (n: any) => typeof n === "number" && Number.isFinite(n) ? n : null
        return [{ accountId: order.accountId, currencyId: i.currency, currency: currencies[0].currency!.code!,
            estimatedCommission: number(i.estimated_commission), forexFees: number(i.forex_fees), remainingCash: number(i.remaining_cash) }]
    })
    if (candidates.some(facts => facts.remainingCash != null && facts.remainingCash < 0))
        throw new TradingError("order_funds_insufficient", "The brokerage estimates insufficient cash after this order, including its reported fees.")
    if (candidates.some(facts => [facts.estimatedCommission, facts.forexFees].some(n => n != null && n < 0)))
        throw new TradingError("order_invalid", "The brokerage returned unverified fee information.")
    return candidates.length === 1 ? candidates[0] : null
}
export async function validateFunds(context: Awaited<ReturnType<typeof ownedTradingAccount>>, order: Terms, q: any, facts: ImpactFacts | null = null) {
    const { st, auth, cap, connection } = context
    if (!cap.orderTypes.includes(order.orderType) || !cap.timeInForce.includes(order.timeInForce)
        || (!Number.isInteger(order.units) && (!cap.fractional || connection.brokerage?.allows_fractional_units !== true)))
        throw new TradingError("order_invalid", "These order terms are not enabled for this brokerage.")
    // Exclude simultaneous/open orders rather than guessing reservations or available-to-sell quantities.
    const { data: open } = await st.accountInformation.getUserAccountOrders({ ...auth, accountId: order.accountId, state: "open" })
    if (!Array.isArray(open) || open.length) throw new TradingError("order_invalid", "Review outstanding orders at your brokerage before placing another order.", 409)
    if (order.action === "SELL") {
        const { data } = await st.accountInformation.getAllAccountPositions({ ...auth, accountId: order.accountId })
        const positions = accountPositions(data).filter(p => ["stock", "etf"].includes(p.instrument.kind)
            && samePositionListing(p, q.symbol)
            && p.currency === q.symbol.currency?.code && p.cash_equivalent !== true)
        if (!positions.length || positions.some(p => positionNumber(p.units)! < 0)
            || positions.reduce((n, p) => n + positionNumber(p.units)!, 0) < order.units)
            throw new TradingError("order_invalid", "The requested shares are not confirmed as available to sell.")
    } else {
        const { data } = await st.accountInformation.getUserAccountBalance({ ...auth, accountId: order.accountId })
        const balance = Array.isArray(data) ? data.find(b => b.currency?.code === q.symbol.currency?.code
            && (!facts || b.currency?.id === facts.currencyId)) : null
        const cash = balance?.cash
        if (facts && (facts.accountId !== order.accountId || facts.currency !== q.symbol.currency?.code
            || facts.remainingCash != null && facts.remainingCash < 0))
            throw new TradingError("order_invalid", "The reviewed cash impact is not valid for this account and currency.")
        // Known fees are included as a lower-bound check, never as a promise
        // that unknown fees/slippage cannot cause a margin debit.
        const knownFees = (facts?.estimatedCommission ?? 0) + (facts?.forexFees ?? 0)
        const price = order.price ?? q.ask_price
        if (!Number.isFinite(cash) || !Number.isFinite(price) || price <= 0)
            throw new TradingError("order_funds_unverified", "Available cash and order cost could not be confirmed.")
        if (cash! < price * order.units + knownFees)
            throw new TradingError("order_funds_insufficient", "Available cash does not cover these terms and the known reviewed fees. Final fees and execution price may differ.")
    }
}
export const unavailableImpact = "Order impact unavailable. A reliable pre-trade impact or fee estimate is not available for this order. The final execution price, transaction amount, commissions, fees, and cash impact may not be known until the order is submitted or executed. Fees may apply. By submitting this order, you agree to proceed without these estimates."

/** Current account details normalize cash versus margin across institutions.
 * Unknown and margin modes remain unsupported for BUY. Re-read on confirm;
 * cash checks and fee estimates still do not guarantee execution costs. */
export function requireExecutionFundingMode(order: Terms, context: Awaited<ReturnType<typeof ownedTradingAccount>>, _session: SnapTradeSession) {
    if (context.account.cash_or_margin !== "cash")
        throw new TradingError("cash_only_unverified",
            "Trading requires a brokerage-confirmed cash account. Margin and unknown account modes are not supported.", 409)
}

/** V2 instrument IDs and universal-symbol IDs are different namespaces.
 * Prefer venue FIGI; otherwise require exact canonical ticker, exchange and
 * currency. Share-class FIGI alone does not identify a trading venue. */
export function samePositionListing(position: any, symbol: any): boolean {
    const instrument = position.instrument
    if (!instrument || !symbol || position.currency !== symbol.currency?.code
        || instrument.currency && instrument.currency !== symbol.currency?.code) return false
    const figi = instrument.figi_instrument?.figi_code
    const quoteFigi = symbol.figi_code ?? symbol.figi_instrument?.figi_code
    if (typeof figi === "string" && figi && typeof quoteFigi === "string" && quoteFigi)
        return figi === quoteFigi
    return typeof symbol.symbol === "string" && symbol.symbol.length > 0
        && instrument.symbol === symbol.symbol && typeof symbol.exchange?.code === "string"
        && symbol.exchange.code.length > 0 && instrument.exchange === symbol.exchange.code
}
