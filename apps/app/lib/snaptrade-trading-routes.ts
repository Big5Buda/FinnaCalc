import { NextRequest } from "next/server"
import { loadSession } from "./snaptrade-session"
import { getSnapTrade, mapOrderRecord } from "./snaptrade"
import { verifiedAppUserId } from "./supabase-auth"
import { accountQuote, bindImpact, requireTradeConnection, requireExecutionFundingMode, ownedTradingAccount, sameTerms, terms, TradingError, tradingGate, unavailableImpact, validateFunds } from "./snaptrade-trading"
import { prepareReviewGeneration } from "./snaptrade-reconciliation"
import { consumeReview, finishReview, loadReview, saveReview } from "./snaptrade-order-reviews"

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
        const order = terms({ ...body, action: "BUY", units: 1, orderType: "Market", timeInForce: "Day", price: null, stop: null })
        const context = await ownedTradingAccount(owner, session, order.accountId)
        const q = await accountQuote(context, order.symbol)
        const number = (n: any) => typeof n === "number" && Number.isFinite(n) ? n : null
        return Response.json({ symbol: order.symbol, bid: number(q.bid_price), ask: number(q.ask_price), last: number(q.last_trade_price), currency: q.symbol.currency.code })
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
        await validateFunds(context, order, q)
        let impactFacts: import("./snaptrade-trading").ImpactFacts | null = null
        let tradeId: string | null = null, estimate: any = { source: "unavailable", disclosure: unavailableImpact }
        if (context.cap.preview) {
            // Preview errors do not silently select direct execution. Capability,
            // not a vendor outage, selects the no-preview flow.
            const { data } = await context.st.trading.getOrderImpact({ ...context.auth,
                account_id: order.accountId, action: order.action, universal_symbol_id: q.symbol.id,
                order_type: order.orderType, time_in_force: order.timeInForce, units: order.units,
                notional_value: null, price: order.price, stop: null })
            if (!data.trade?.id) throw new TradingError("order_invalid", "The brokerage did not validate this order.", 502)
            tradeId = data.trade.id
            // Never let provider-normalized terms silently differ from reviewed terms.
            if (data.trade.units !== order.units || data.trade.account !== order.accountId
                || data.trade.action !== order.action || data.trade.order_type !== order.orderType
                || data.trade.time_in_force !== order.timeInForce || data.trade.symbol?.universal_symbol_id !== q.symbol.id
                || (order.orderType === "Limit" && data.trade.price !== order.price)) throw new TradingError("order_invalid", "The brokerage returned different order terms. Review at your brokerage.", 502)
            impactFacts = await bindImpact(context, order, q, data.trade_impacts)
            await validateFunds(context, order, q, impactFacts)
            const number = (n: any) => typeof n === "number" && Number.isFinite(n) ? n : null
            // Monetary estimates require verified matching-account currency metadata.
            estimate = { source: impactFacts ? "brokerage" : "unavailable", units: number(data.trade.units),
                ...(impactFacts ? { price: number(data.trade.price) } : {}), symbolCurrency: q.symbol.currency?.code ?? null,
                exchange: q.symbol.exchange?.code ?? null,
                ...(impactFacts ? { estimatedCommission: impactFacts.estimatedCommission, forexFees: impactFacts.forexFees,
                    remainingCash: impactFacts.remainingCash, currency: impactFacts.currency } : { disclosure: unavailableImpact }) }

        }
        const expiresAt = new Date(Date.now() + 4 * 60_000).toISOString()
        const review = await saveReview({ owner_id: owner, client_id: session.clientId!, vendor_user_id: session.userId,
            generation, terms: order, symbol_id: q.symbol.id, impact_facts: impactFacts, trade_id: tradeId, expires_at: expiresAt })
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
        if (Date.parse(review.expires_at) <= Date.now()) throw new TradingError("order_review_expired", "This unsubmitted review expired. Review the order again.", 409)
        const context = await ownedTradingAccount(owner, session, review.terms.accountId)
        const q = await accountQuote(context, review.terms.symbol)
        if (q.symbol.id !== review.symbol_id || (Boolean(review.trade_id) !== context.cap.preview))
            throw new TradingError("order_review_mismatch", "The listing or execution workflow changed. Nothing was submitted by this request.", 409)
        await validateFunds(context, review.terms, q, review.impact_facts)
        requireExecutionFundingMode(review.terms, context, session)
        if (!await consumeReview(review.id, owner, session.clientId!, session.userId))
            throw new TradingError("order_review_used", "A submission may already be in progress. Check order history; do not submit again.", 409)
        submitted = true
        const order = review.terms
        // Retain the same provider symbol and execution mode on confirm.
        const raw = review.trade_id
            ? await context.st.trading.placeOrder({ ...context.auth, tradeId: review.trade_id, wait_to_confirm: true })
            : await context.st.trading.placeForceOrder({ ...context.auth, account_id: order.accountId,
                action: order.action, universal_symbol_id: review.symbol_id, symbol: null, units: order.units,
                notional_value: null, order_type: order.orderType, time_in_force: order.timeInForce,
                price: order.price, stop: null, client_order_id: review.id })
        const mapped = mapOrderRecord(raw.data)
        if (!mapped.brokerageOrderId || !mapped.status) throw new Error("Unconfirmed brokerage response")
        const result = { ...mapped, accountId: order.accountId }
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
