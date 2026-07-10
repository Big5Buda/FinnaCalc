import { createHmac, timingSafeEqual } from "crypto"

/**
 * SnapTrade webhook signature verification.
 *
 * SnapTrade signs each webhook with an HMAC-SHA256 of the request body, keyed
 * by your **consumer key** (not the deprecated `webhookSecret` field), sent in
 * the `Signature` header (base64). The body is canonicalized the same way
 * SnapTrade does it in their example: JSON with sorted keys and compact
 * (",", ":") separators.
 */

/** Recursively sorts object keys so JSON.stringify emits SnapTrade's canonical form. */
function canonical(value: any): any {
    if (Array.isArray(value)) return value.map(canonical)
    if (value && typeof value === "object") {
        return Object.keys(value)
            .sort()
            .reduce((acc: Record<string, any>, k) => {
                acc[k] = canonical(value[k])
                return acc
            }, {})
    }
    return value
}

function safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) return false
    return timingSafeEqual(bufA, bufB)
}

/** True if `signature` (the `Signature` header) authenticates `payload`. */
export function verifySnapTradeWebhook(payload: unknown, signature: string | null): boolean {
    const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY
    if (!consumerKey || !signature) return false
    // JSON.stringify uses compact separators by default; canonical() sorts keys.
    const body = JSON.stringify(canonical(payload))
    const expected = createHmac("sha256", consumerKey).update(body).digest("base64")
    return safeEqual(expected, signature)
}

/** True if the event is recent enough to not be a replay (SnapTrade: 300s). */
export function webhookTimestampFresh(eventTimestamp: unknown, nowMs = Date.now()): boolean {
    if (typeof eventTimestamp !== "string") return false
    const t = Date.parse(eventTimestamp)
    if (Number.isNaN(t)) return false
    return Math.abs(nowMs - t) <= 300_000
}
