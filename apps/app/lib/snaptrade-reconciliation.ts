import { getSnapTrade, type SnapTradeSession } from "./snaptrade"
import { captureReviewGeneration, ownerReservation, resolveAcknowledgedReview, type Review } from "./snaptrade-order-reviews"
import { positionNumber } from "./snaptrade-positions"
import { TradingError } from "./snaptrade-trading"

function blocked(): never { throw new TradingError("order_reconciliation_required", "An earlier order is not yet reconciled. Check brokerage order history before reviewing another order.", 409) }
/** Strict known-ACK binding. Missing fields and unsupported partial/replaced
 * states retain the reservation. No raw provider body is persisted or logged. */
export function terminalOrderEvidence(review: Review, raw: any): Record<string, unknown> | null {
    const order = review.terms
    const total = positionNumber(raw?.total_quantity), filled = positionNumber(raw?.filled_quantity), open = positionNumber(raw?.open_quantity)
    if (!raw || raw.brokerage_order_id !== review.result?.brokerageOrderId || review.result?.accountId !== order.accountId
        || raw.universal_symbol?.id !== review.symbol_id || raw.universal_symbol?.symbol !== order.symbol
        || raw.universal_symbol?.currency?.code !== "USD" || !["cs", "et"].includes(raw.universal_symbol?.type?.code)
        || raw.action !== order.action || total !== order.units || raw.order_type !== order.orderType || raw.time_in_force !== order.timeInForce
        || raw.option_symbol != null || raw.brokerage_group_order_id != null || raw.stop_price != null || raw.trailing_stop != null
        || (order.orderType === "Limit" ? positionNumber(raw.limit_price) !== order.price : raw.limit_price != null)
        || open !== 0 || filled == null) return null
    const terminal = raw.status === "EXECUTED" ? filled === total
        : ["REJECTED", "CANCELED", "EXPIRED"].includes(raw.status) && filled === 0
    if (!terminal) return null
    return { source: "snaptrade_order_detail", brokerageOrderId: raw.brokerage_order_id, accountId: order.accountId,
        symbolId: review.symbol_id, status: raw.status, action: order.action, orderType: order.orderType, timeInForce: order.timeInForce, limitPrice: order.price, openQuantity: open, totalQuantity: total, filledQuantity: filled, observedAt: new Date().toISOString() }
}
export async function prepareReviewGeneration(owner: string, session: SnapTradeSession): Promise<string> {
    // At most one bounded read-only reconciliation, then a fresh attempt. Each
    // attempt captures durable generation BEFORE provider reads; no old quote,
    // preview, cash or positions can be carried into the restarted attempt.
    for (let attempt = 0; attempt < 2; attempt++) {
        const generation = await captureReviewGeneration(owner)
        const pending = await ownerReservation(owner)
        if (!pending) return generation
        if (pending.owner_id !== owner || pending.client_id !== session.clientId || pending.vendor_user_id !== session.userId) blocked()
        if (pending.state !== "complete") throw new TradingError("order_status_unknown", "An earlier submission has uncertain status. Check order history; do not submit it again.", 409)
        if (attempt || typeof pending.result?.brokerageOrderId !== "string" || !pending.result.brokerageOrderId.trim()
            || pending.result.accountId !== pending.terms.accountId) blocked()
        let raw: any
        try {
            const response = await getSnapTrade(session).accountInformation.getUserAccountOrderDetail({
                userId: session.userId, userSecret: session.userSecret, accountId: pending.terms.accountId,
                brokerage_order_id: pending.result.brokerageOrderId,
            })
            raw = response.data
        } catch { blocked() }
        const evidence = terminalOrderEvidence(pending, raw)
        if (!evidence || !await resolveAcknowledgedReview(pending, generation, evidence)) blocked()
    }
    return blocked()
}
