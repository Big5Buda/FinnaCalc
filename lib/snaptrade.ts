import { NextResponse } from "next/server"
import { Snaptrade } from "snaptrade-typescript-sdk"

/**
 * Server-side SnapTrade client.
 *
 * Required environment variables (free dev tier at https://dashboard.snaptrade.com):
 *   SNAPTRADE_CLIENT_ID
 *   SNAPTRADE_CONSUMER_KEY
 *
 * Per-user credentials: SnapTrade returns a { userId, userSecret } pair on
 * registration, stored server-side keyed to the Supabase user
 * (lib/snaptrade-session.ts) — never on the client.
 */

const clientId = process.env.SNAPTRADE_CLIENT_ID
const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY

export const isSnapTradeConfigured = Boolean(clientId && consumerKey)

/** Legacy client-held cookie name, kept only so old cookies can be cleared. */
export const SNAPTRADE_COOKIE = "snaptrade_session"

export interface SnapTradeSession {
    userId: string
    userSecret: string
}

let client: Snaptrade | null = null

export function getSnapTrade(): Snaptrade {
    if (!isSnapTradeConfigured) {
        throw new Error("SnapTrade is not configured.")
    }
    if (!client) {
        client = new Snaptrade({ clientId: clientId as string, consumerKey: consumerKey as string })
    }
    return client
}

/** Wipes any leftover pre-migration cookie. Its contents are never read or trusted. */
export function clearLegacySnapTradeCookie(res: NextResponse): void {
    res.cookies.set(SNAPTRADE_COOKIE, "", { maxAge: 0, path: "/" })
}

export function snapTradeErrorMessage(err: any, fallback: string): string {
    return (
        err?.responseBody?.detail ||
        err?.response?.data?.detail ||
        err?.responseBody?.message ||
        err?.message ||
        fallback
    )
}

/** SnapTrade returns order quantities/prices as strings — parse defensively. */
function num(v: unknown): number | null {
    if (v == null) return null
    const n = typeof v === "number" ? v : parseFloat(String(v))
    return Number.isFinite(n) ? n : null
}

/**
 * Maps a SnapTrade AccountOrderRecord to the camelCase JSON shape shared by
 * the place/orders/cancel routes (and decoded by the iOS SnapTradeOrder model).
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
