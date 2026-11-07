import { NextResponse } from "next/server"
import { Snaptrade, SnaptradeAuth } from "snaptrade-typescript-sdk"

/**
 * Server-side SnapTrade client.
 *
 * Original key retained in place for existing users:
 *   SNAPTRADE_CLIENT_ID
 *   SNAPTRADE_CONSUMER_KEY
 * New production key: SNAPTRADE_NEXT_CLIENT_ID / SNAPTRADE_NEXT_CONSUMER_KEY,
 * used for new users only by SNAPTRADE_USE_PRODUCTION_KEY=true (Production only).
 * Every existing session selects its recorded client ID, never the active key.
 *
 * Per-user credentials: SnapTrade returns a { userId, userSecret } pair on
 * registration, stored server-side keyed to the Supabase user
 * (lib/snaptrade-session.ts) — never on the client.
 */

const originalClientId = process.env.SNAPTRADE_CLIENT_ID
const originalConsumerKey = process.env.SNAPTRADE_CONSUMER_KEY
const productionClientId = process.env.SNAPTRADE_NEXT_CLIENT_ID
const productionConsumerKey = process.env.SNAPTRADE_NEXT_CONSUMER_KEY
const useProductionKey = process.env.SNAPTRADE_USE_PRODUCTION_KEY === "true"
const clientId = useProductionKey ? productionClientId : originalClientId
const consumerKey = useProductionKey ? productionConsumerKey : originalConsumerKey

// One unavailable registration key must not disable users owned by the other.
export const isSnapTradeConfigured = Boolean(
    (originalClientId && originalConsumerKey) || (productionClientId && productionConsumerKey)
)

/** Legacy client-held cookie name, kept only so old cookies can be cleared. */
export const SNAPTRADE_COOKIE = "snaptrade_session"

export interface SnapTradeSession {
    userId: string
    userSecret: string
    /** Owner of these user credentials; never inferred from the active key. */
    clientId: string
}

type Credentials = { clientId: string; consumerKey: string }
type CommercialClient = Snaptrade<ReturnType<typeof SnaptradeAuth.commercialApiKey>>
const clients = new Map<string, CommercialClient>()

/** Existing ownership survives flag rollback; the flag selects NEW users only. */
export function snapTradeCredentials(ownerClientId: string): Credentials {
    if (!ownerClientId) throw new Error("Brokerage key ownership is missing. Please contact support.")
    if (ownerClientId === originalClientId && ownerClientId === productionClientId && originalConsumerKey && productionConsumerKey && originalConsumerKey !== productionConsumerKey) {
        throw new Error("Brokerage key configuration conflicts. Your connection has been preserved; please contact support.")
    }
    if (ownerClientId === originalClientId && originalConsumerKey) return { clientId: originalClientId, consumerKey: originalConsumerKey }
    if (ownerClientId === productionClientId && productionConsumerKey) return { clientId: productionClientId, consumerKey: productionConsumerKey }
    throw new Error("This brokerage connection's key is unavailable. Your connection has been preserved; please contact support.")
}

/** Operator approval for an existing owned credential, never a key selector.
 * Namespaces avoid retrieving sensitive environment values during rollout.
 * Clear/review namespace approval before replacing either credential slot. */
export function snapTradeKeyNamespace(ownerClientId: string): "original" | "next" {
    snapTradeCredentials(ownerClientId)
    return ownerClientId === originalClientId ? "original" : "next"
}

export function isTradingKeyApproved(ownerClientId: string): boolean {
    try { snapTradeCredentials(ownerClientId) } catch { return false }
    const exact = (process.env.SNAPTRADE_TRADING_APPROVED_CLIENT_IDS ?? "").split(",").map(v => v.trim()).filter(Boolean)
    if (exact.includes(ownerClientId)) return true
    const namespaces = (process.env.SNAPTRADE_TRADING_APPROVED_KEY_NAMESPACES ?? "").split(",").map(v => v.trim()).filter(Boolean)
    if (!namespaces.length || namespaces.some(v => v !== "original" && v !== "next")) return false
    return namespaces.some(v => v === "original" ? ownerClientId === originalClientId : ownerClientId === productionClientId)
}

export function activeSnapTradeClientId(): string {
    if (!clientId || !consumerKey) throw new Error("SnapTrade is not configured.")
    snapTradeCredentials(clientId)
    return clientId
}

export function configuredSnapTradeClientIds(): string[] {
    return [...new Set([
        ...(productionClientId && productionConsumerKey ? [productionClientId] : []),
        ...(originalClientId && originalConsumerKey ? [originalClientId] : []),
    ])]
}

export function getSnapTrade(owner: Pick<SnapTradeSession, "clientId">): CommercialClient {
    const credentials = snapTradeCredentials(owner.clientId)
    let client = clients.get(credentials.clientId)
    if (!client) {
        client = new Snaptrade({ auth: SnaptradeAuth.commercialApiKey(credentials) })
        clients.set(credentials.clientId, client)
    }
    return client
}

/** Wipes any leftover pre-migration cookie. Its contents are never read or trusted. */
export function clearLegacySnapTradeCookie(res: NextResponse): void {
    res.cookies.set(SNAPTRADE_COOKIE, "", { maxAge: 0, path: "/" })
}

// NOTE: no app-level 429 retry helper — the SnapTrade SDK already retries
// rate-limited requests internally (3x with backoff) before throwing, so a
// wrapper here would never see a 429. snapTradeErrorMessage maps the SDK's
// exhausted-429 error to a friendly message instead.

export function snapTradeErrorMessage(err: any, fallback: string): string {
    // The SnapTrade SDK retries HTTP 429 internally (3x backoff) and, once
    // exhausted, throws a plain Error mentioning "429 (rate limit)". Surface a
    // clean, actionable message for that instead of the raw SDK text.
    if (typeof err?.message === "string" && /429|rate limit/i.test(err.message) && err?.status == null) {
        return "The brokerage service is busy right now (rate limited). Please try again in a moment."
    }
    const candidates = [
        err?.responseBody?.detail,
        err?.response?.data?.detail,
        err?.responseBody?.message,
        err?.message,
    ]
    for (const c of candidates) {
        if (typeof c !== "string" || !c.trim()) continue
        // SnapTrade sometimes returns a terse machine code/slug (e.g.
        // "symbols_search") rather than user-facing text — a single snake_case
        // token with no spaces. Skip those in favor of the friendly fallback.
        if (!/\s/.test(c) && /_/.test(c)) continue
        return c
    }
    return fallback
}

/** SnapTrade returns order quantities/prices as strings — parse defensively. */
function num(v: unknown): number | null {
    if (v == null) return null
    const n = typeof v === "number" ? v : parseFloat(String(v))
    return Number.isFinite(n) ? n : null
}

/**
 * Maps a SnapTrade AccountOrderRecord to the camelCase JSON shape shared by
 * the read-only orders route (and decoded by the iOS SnapTradeOrder model).
 */
export function mapOrderRecord(o: any) {
    return {
        brokerageOrderId: o?.brokerage_order_id ?? null,
        status: o?.status ?? null,
        symbol: o?.universal_symbol?.symbol ?? o?.option_symbol?.ticker ?? null,
        action: o?.action ?? null,
        totalQuantity: num(o?.total_quantity),
        filledQuantity: num(o?.filled_quantity),
        executionPrice: num(o?.execution_price),
        limitPrice: num(o?.limit_price),
        orderType: o?.order_type ?? null,
        timeInForce: o?.time_in_force ?? null,
        timePlaced: o?.time_placed ?? null,
    }
}
