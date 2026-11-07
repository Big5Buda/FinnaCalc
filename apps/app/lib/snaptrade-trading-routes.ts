import { NextRequest } from "next/server"
import { loadSession } from "./snaptrade-session"
import { getSnapTrade, mapOrderRecord } from "./snaptrade"
import { verifiedAppUserId } from "./supabase-auth"
import { accountQuote, bindImpact, requireTradeConnection, requireExecutionFundingMode, ownedTradingAccount, sameTerms, terms, TradingError, tradingGate, unavailableImpact, validateFunds } from "./snaptrade-trading"
import { ackQuantityEvidence, prepareReviewGeneration } from "./snaptrade-reconciliation"
import { consumeReview, finishReview, loadReview, saveReview } from "./snaptrade-order-reviews"
import { dollarEligibility, fractionalEligibility, requireFractionalEligibility, orderCapabilities, requireDollarEligibility } from "./snaptrade-order-capabilities"
import type { Terms } from "./snaptrade-trading"

/** Approximate reciprocal for display: shares → dollars, dollars → shares.
 * Basis is the limit price, else ask for BUY / bid for SELL. */
export function quoteEstimate(order: Terms, q: any) {
    const side = order.action === "BUY" ? q?.ask_price : q?.bid_price
    const basis = order.orderType === "Limit" ? "limit" : order.action === "BUY" ? "ask" : "bid"
    const price = order.orderType === "Limit" ? order.price : side
    if (!(typeof price === "number" && Number.isFinite(price) && price > 0)) return null
    if (order.amountMode === "dollars")
        return { basis, price, approxUnits: Math.round(Number(order.notionalValue) / price * 1e6) / 1e6 }
    return { basis, price, approxNotional: Math.round(order.units! * price * 100) / 100 }
}

const REVIEW_BUDGET_MS = 4 * 60_000
function requireReviewBudget(expiresAt: number): void {
    if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt)
        throw new TradingError("order_review_expired", "This unsubmitted review expired. Review the order again.", 409)
}

async function identity(req: NextRequest) {
    const owner = await verifiedAppUserId(req)
    if (!owner) throw new TradingError("unauthorized", "Sign in to continue.", 401)
    const session = await loadSession(owner)
    if (!session) throw new TradingError("brokerage_not_connected", "Connect your brokerage to continue.", 401)
    tradingGate(session.clientId)
    return { owner, session }
}
function errorResponse(error: unknown) {
    return error instanceof TradingError
        ? Response.json({ code: error.code, error: error.message }, { status: error.status })
        : Response.json({ code: "trading_unavailable", error: "Brokerage access could not be confirmed. Try again before submitting an order." }, { status: 503 })
}
async function json(req: NextRequest) {
    try { return await req.json() } catch { throw new TradingError("order_invalid", "Invalid request body.") }
}
export async function quote(req: NextRequest) {
    try {
        const { owner, session } = await identity(req), body = await json(req)
        // Reuse quantity-independent validation without letting client account/symbol bypass ownership.
        // Only accountId/symbol are read; client amount/capability fields are ignored.
        const order = terms({ accountId: body?.accountId, symbol: body?.symbol, action: "BUY", units: 1, orderType: "Market", timeInForce: "Day", price: null, stop: null })
        const context = await ownedTradingAccount(owner, session, order.accountId)
        const q = await accountQuote(context, order.symbol)
        const number = (n: any) => typeof n === "number" && Number.isFinite(n) ? n : null
        // Sizing eligibility may be unavailable while whole-share quotes remain valid.
        const dollars = await dollarEligibility(context, session.clientId!, q, { fresh: false })
        return Response.json({ symbol: order.symbol, bid: number(q.bid_price), ask: number(q.ask_price), last: number(q.last_trade_price), currency: q.symbol.currency.code,
            orderCapabilities: orderCapabilities(context, q.symbol.currency.code, dollars, await fractionalEligibility(context, session.clientId!, q, { fresh: false })) },
            { headers: { "Cache-Control": "private, no-store" } })
    } catch (error) { return errorResponse(error) }
}
export async function impact(req: NextRequest) {
    try {
        const { owner, session } = await identity(req), order = terms(await json(req))
        // Durable epoch captured before any account/quote/impact provider reads.
        const generation = await prepareReviewGeneration(owner, session)
        const context = await ownedTradingAccount(owner, session, order.accountId)
        const q = await accountQuote(context, order.symbol)
        requireExecutionFundingMode(order, context, session)
        const dollars = order.amountMode === "dollars"
        // Sizing policy, cash and instrument eligibility precede the required
        // exact checked preview. No caller capability claims are trusted.
        if (dollars) await requireDollarEligibility(context, session.clientId!, q, { fresh: false })
        await requireFractionalEligibility(context, session.clientId!, q, order, { fresh: false })
        await validateFunds(context, order, q)
        let impactFacts: import("./snaptrade-trading").ImpactFacts | null = null
        let tradeId: string | null = null, estimate: any = { source: "unavailable", disclosure: unavailableImpact }
        let brokerageEstimatedUnits: number | null = null
        const number = (n: any) => typeof n === "number" && Number.isFinite(n) ? n : null
        if (dollars && !context.cap.preview) throw new TradingError("dollar_orders_unavailable", "Dollar orders require a brokerage preview.", 409)
        // Capture before the checked trade can be created. Slow preview or
        // subsequent reads must never extend its five-minute provider lifetime.
        const expiresAtMs = Date.now() + REVIEW_BUDGET_MS
        if (context.cap.preview) {
            // Preview errors do not silently select direct execution. Capability,
            // not a vendor outage, selects the no-preview flow. Dollar orders send
            // the exact notional with units null — never units derived from a quote.
            const { data } = await context.st.trading.getOrderImpact({ ...context.auth,
                account_id: order.accountId, action: order.action, universal_symbol_id: q.symbol.id,
                order_type: order.orderType, time_in_force: order.timeInForce,
                units: dollars ? null : order.units, notional_value: dollars ? order.notionalValue : null,
                price: order.price, stop: null })
            if (typeof data?.trade?.id !== "string" || !data.trade.id.trim()) throw new TradingError("order_invalid", "The brokerage did not validate this order.", 502)
            tradeId = data.trade.id
            // Never let provider-normalized terms silently differ from reviewed terms.
            // ManualTrade has no notional echo; for dollars the request binding is
            // impact(canonical request) → trade.id → placeOrder(stored trade.id).
            // Provider `units` for dollars is a nullable brokerage estimate only.
            const unitsMismatch = dollars
                ? data.trade.units != null && !(number(data.trade.units) != null && data.trade.units > 0)
                : data.trade.units !== order.units
            if (unitsMismatch || data.trade.account !== order.accountId
                || data.trade.action !== order.action || data.trade.order_type !== order.orderType
                || data.trade.time_in_force !== order.timeInForce || data.trade.symbol?.universal_symbol_id !== q.symbol.id
                || (order.orderType === "Limit" && data.trade.price !== order.price)) throw new TradingError("order_invalid", "The brokerage returned different order terms. Review at your brokerage.", 502)
            if (dollars) brokerageEstimatedUnits = number(data.trade.units)
            impactFacts = await bindImpact(context, order, q, data.trade_impacts)
            await validateFunds(context, order, q, impactFacts)
            // Monetary estimates require verified matching-account currency metadata.
            estimate = { source: impactFacts ? "brokerage" : "unavailable",
                ...(dollars ? { brokerageEstimatedUnits } : { units: number(data.trade.units) }),
                ...(impactFacts ? { price: number(data.trade.price) } : {}), symbolCurrency: q.symbol.currency?.code ?? null,
                exchange: q.symbol.exchange?.code ?? null,
                ...(impactFacts ? { estimatedCommission: impactFacts.estimatedCommission, forexFees: impactFacts.forexFees,
                    remainingCash: impactFacts.remainingCash, currency: impactFacts.currency } : { disclosure: unavailableImpact }) }
        }
        // Reciprocal display estimate from the live quote, labelled approximate;
        // null when the relevant quote side is missing. Never execution input.
        estimate = { ...estimate, amountMode: order.amountMode, quoteEstimate: quoteEstimate(order, q),
            ...(dollars ? { amountVerification: "request_bound" } : {}) }
        requireReviewBudget(expiresAtMs)
        const expiresAt = new Date(expiresAtMs).toISOString()
        const review = await saveReview({ owner_id: owner, client_id: session.clientId!, vendor_user_id: session.userId,
            generation, terms: order, symbol_id: q.symbol.id, impact_facts: impactFacts, trade_id: tradeId, expires_at: expiresAt },
            dollars ? { estimate_units: brokerageEstimatedUnits, amount_verification: "request_bound" } : undefined)
        return Response.json({ reviewId: review.id, expiresAt, terms: order, estimate })
    } catch (error) { return errorResponse(error) }
}
export async function place(req: NextRequest) {
    let submitted = false, reviewedUnconsumed = false, reviewId: string | undefined, ownerId: string | undefined
    try {
        const { owner, session } = await identity(req), body = await json(req)
        ownerId = owner
        if (!body || body.confirmed !== true || typeof body.reviewId !== "string")
            throw new TradingError("order_confirmation_required", "Explicitly confirm the reviewed terms before submitting.")
        reviewId = body.reviewId
        const review = await loadReview(reviewId!, owner)
        if (!review) throw new TradingError("order_review_not_found", "This review is not available for this account.", 404)
        // Consumed takes precedence over expiry; it can already represent a real order.
        if (review.state !== "reviewing") throw new TradingError("order_review_used", "This review may already have been submitted. Check order history before taking further action.", 409)
        reviewedUnconsumed = true
        if (review.client_id !== session.clientId || review.vendor_user_id !== session.userId || !sameTerms(review.terms, terms(body.terms)))
            throw new TradingError("order_review_mismatch", "These terms no longer match the review. Nothing was submitted by this request.", 409)
        requireReviewBudget(Date.parse(review.expires_at))
        // Stored V3 share rows omit amountMode; canonicalize the stored terms.
        const order = terms(review.terms), dollars = order.amountMode === "dollars"
        const context = await ownedTradingAccount(owner, session, order.accountId)
        const q = await accountQuote(context, order.symbol)
        if (q.symbol.id !== review.symbol_id || (Boolean(review.trade_id) !== context.cap.preview)
            || ((dollars || !Number.isInteger(order.units)) && (typeof review.trade_id !== "string" || !review.trade_id.trim())))
            throw new TradingError("order_review_mismatch", "The listing or execution workflow changed. Nothing was submitted by this request.", 409)
        // Confirm re-reads instrument metadata upstream (no TTL reuse).
        if (dollars) await requireDollarEligibility(context, session.clientId!, q, { fresh: true })
        await requireFractionalEligibility(context, session.clientId!, q, order, { fresh: true })
        await validateFunds(context, order, q, review.impact_facts)
        requireExecutionFundingMode(order, context, session)
        // Revalidation may have exhausted the fixed preview budget. Check
        // immediately before the RPC, whose atomic expiry check remains final.
        requireReviewBudget(Date.parse(review.expires_at))
        if (!await consumeReview(review.id, owner, session.clientId!, session.userId))
            throw new TradingError("order_review_used", "A submission may already be in progress. Check order history; do not submit again.", 409)
        submitted = true
        // Retain the same provider symbol and execution mode on confirm. Dollar
        // and fractional orders use ONLY the stored checked trade; never direct execution.
        const raw = review.trade_id
            ? await context.st.trading.placeOrder({ ...context.auth, tradeId: review.trade_id, wait_to_confirm: true })
            : dollars || !Number.isInteger(order.units) ? (() => { throw new Error("Sized order without checked trade") })()
            : await context.st.trading.placeForceOrder({ ...context.auth, account_id: order.accountId,
                action: order.action, universal_symbol_id: review.symbol_id, symbol: null, units: order.units,
                notional_value: null, order_type: order.orderType, time_in_force: order.timeInForce,
                price: order.price, stop: null, client_order_id: review.id })
        const mapped = mapOrderRecord(raw.data)
        if (!mapped.brokerageOrderId || !mapped.status) throw new Error("Unconfirmed brokerage response")
        // Display fields are unchanged; dollar orders also persist a strict,
        // presence-preserving ACK quantity record from the raw body for reconciliation.
        const result = { ...mapped, accountId: order.accountId, ...(dollars ? { ackQuantity: ackQuantityEvidence(raw.data) } : {}) }
        await finishReview(review.id, owner, result, false)
        return Response.json(result)
    } catch (error) {
        if (!submitted) {
            if (reviewedUnconsumed && error instanceof TradingError && error.code !== "order_review_used") {
                return Response.json({ code: error.code,
                    error: `${error.message} This request did not submit an order.`,
                    submissionStatus: "not_submitted_by_this_request" }, { status: error.status })
            }
            // Identity/release-gate/transport/storage failures before an
            // unconsumed review is confirmed do not establish prior status.
            return errorResponse(error)
        }
        // A timeout/rejection/persistence error after consuming is never proof
        // that the broker did not submit; retain the durable lock for reconciliation.
        try { await finishReview(reviewId!, ownerId!, null, true) } catch { /* submitting remains locked */ }
        return Response.json({ code: "order_status_unknown", error: "Submission status is unknown. Check brokerage order history before taking further action.", reviewId }, { status: 502 })
    }
}
export async function upgrade(req: NextRequest) {
    try {
        const { owner, session } = await identity(req), body = await json(req)
        if (body?.consent !== true || typeof body.connectionId !== "string")
            throw new TradingError("trading_consent_required", "Confirm that you want to authorize trading for this connection.")
        const st = getSnapTrade(session), auth = { userId: session.userId, userSecret: session.userSecret }
        const { data } = await st.connections.listBrokerageAuthorizations(auth)
        const c = data.find(c => c.id === body.connectionId)
        if (!c) throw new TradingError("connection_not_owned", "This connection does not belong to this user.", 404)
        // This explicit upgrade is separate from read-only reconnect; never delete/relink.
        if (c.type !== "read" || c.disabled || c.brokerage?.allows_trading !== true)
            throw new TradingError("trading_permission_required", "Trading upgrade availability for this connection could not be confirmed.", 409)
        await requireTradeConnection(session.clientId, c.brokerage.slug ?? "")
        const { brokerageReadScope } = await import("./snaptrade-access")
        const scope = await brokerageReadScope(owner, session, data, true)
        if ("denied" in scope) {
            // Preserve the structured denial and status (notably entitlement503).
            return scope.denied
        }
        if (scope.countedConnectionId && scope.countedConnectionId !== c.id)
            throw new TradingError("brokerage_connection_limit", "This connection is outside the confirmed plan allowance.", 403)
        const { data: login } = await st.authentication.loginSnapTradeUser({ ...auth, reconnect: c.id,
            connectionType: "trade", customRedirect: "finnacalc://snaptrade-callback", immediateRedirect: true })
        if (!("redirectURI" in login) || typeof login.redirectURI !== "string" || !login.redirectURI) throw new Error("Portal unavailable")
        return Response.json({ redirectURI: login.redirectURI })
    } catch (error) { return errorResponse(error) }
}
