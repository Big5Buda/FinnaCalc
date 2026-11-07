import { getSnapTrade, type SnapTradeSession } from "./snaptrade"
import { captureReviewGeneration, ownerReservation, resolveAcknowledgedReview, type Review } from "./snaptrade-order-reviews"
import { positionNumber } from "./snaptrade-positions"
import { TradingError } from "./snaptrade-trading"

function blocked(): never { throw new TradingError("order_reconciliation_required", "An earlier order is not yet reconciled. Check brokerage order history before reviewing another order.", 409) }
/** Strict known-ACK binding. Missing fields and unsupported partial/replaced
 * states retain the reservation. No raw provider body is persisted or logged. */
export function terminalOrderEvidence(review: Review, raw: any): Record<string, unknown> | null {
    if (review.terms.amountMode === "dollars") return dollarTerminalEvidence(review, raw)
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
/** Placement-time ACK quantity for dollar orders, captured from the RAW
 * provider body (not the lenient display mapper, whose parseFloat turns
 * "abc" into null and "2.5junk" into 2.5). Presence is preserved:
 * absent key / undefined → "absent"; explicit null → "null"; a strictly
 * formatted positive decimal (no sign/exponent/prefix/suffix) → "positive";
 * anything else, including zero → "invalid" (keeps the reservation locked). */
export type AckQuantity = { state: "absent" } | { state: "null" } | { state: "positive"; value: number } | { state: "invalid" }
export function ackQuantityEvidence(data: any): AckQuantity {
    if (!data || typeof data !== "object" || data.total_quantity === undefined) return { state: "absent" }
    const v = data.total_quantity
    if (v === null) return { state: "null" }
    const n = typeof v === "number" ? v : typeof v === "string" && /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(v) ? Number(v) : NaN
    return Number.isFinite(n) && n > 0 ? { state: "positive", value: n } : { state: "invalid" }
}
/** Dollar (notional) terminal binding. Quantities are the broker's actual
 * values, never inferred from the dollar amount; execution price × filled is
 * not required to equal the notional (rounding/fees). The stored ACK quantity
 * (`result.ackQuantity`, see ackQuantityEvidence) must be a recognised record:
 * absent/null → no ACK quantity; positive → immutable, must equal the total;
 * invalid, zero, missing record or unknown shape → stays locked.
 * Partial/replaced/pending/missing evidence keeps the lock. */
export function dollarTerminalEvidence(review: Review, raw: any): Record<string, unknown> | null {
    const order = review.terms
    if (order.amountMode !== "dollars" || typeof order.notionalValue !== "string" || order.units != null) return null
    const total = positionNumber(raw?.total_quantity), filled = positionNumber(raw?.filled_quantity), open = positionNumber(raw?.open_quantity)
    const record = review.result?.ackQuantity
    let ack: number | null
    if (record?.state === "absent" || record?.state === "null") ack = null
    else if (record?.state === "positive" && typeof record.value === "number" && Number.isFinite(record.value) && record.value > 0) ack = record.value
    else return null
    if (!raw || typeof raw.brokerage_order_id !== "string" || !raw.brokerage_order_id
        || raw.brokerage_order_id !== review.result?.brokerageOrderId || review.result?.accountId !== order.accountId
        || raw.universal_symbol?.id !== review.symbol_id || raw.universal_symbol?.symbol !== order.symbol
        || raw.universal_symbol?.currency?.code !== "USD" || !["cs", "et"].includes(raw.universal_symbol?.type?.code)
        || raw.action !== order.action || raw.order_type !== "Market" || raw.time_in_force !== "Day"
        || raw.option_symbol != null || raw.brokerage_group_order_id != null || raw.stop_price != null || raw.trailing_stop != null
        || raw.limit_price != null
        || total == null || filled == null || open !== 0 || total < 0 || filled < 0
        || (ack != null && total !== ack)) return null
    const terminal = raw.status === "EXECUTED" ? total > 0 && filled === total
        : ["REJECTED", "CANCELED", "EXPIRED"].includes(raw.status) && filled === 0
    if (!terminal) return null
    return { source: "snaptrade_order_detail", brokerageOrderId: raw.brokerage_order_id, accountId: order.accountId,
        symbolId: review.symbol_id, status: raw.status, action: order.action, orderType: "Market", timeInForce: "Day", limitPrice: null,
        amountMode: "dollars", notionalValue: order.notionalValue, quantityBasis: "broker_actual", ackQuantity: ack,
        openQuantity: open, totalQuantity: total, filledQuantity: filled, observedAt: new Date().toISOString() }
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
