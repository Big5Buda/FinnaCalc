/**
 * Typed reads and writes of the SnapTrade routes — the browser twin of
 * Core/SnapTrade/SnapTradeService.swift.
 *
 * The SnapTrade session lives in an httpOnly cookie the connect response sets;
 * same-origin fetches carry it automatically. Trading routes additionally
 * require a signed-in FinnaCalc user, so a stolen cookie alone can't place an
 * order — apiPost sends the Supabase bearer token with every call.
 */

import { apiGet, apiPost } from "@/lib/api-client"

export type BrokerageAccount = {
    id: string
    name: string
    institution: string
    number: string
    totalValue: number | null
    /** Available cash (buying power) — shown on the order ticket. */
    cash: number | null
    currency: string
    connectionId: string | null
}

export type BrokeragePosition = {
    accountId: string
    symbol: string
    description: string
    units: number
    price: number | null
    marketValue: number | null
    openPnl: number | null
}

export type AccountsResponse = {
    configured: boolean
    connected?: boolean
    accounts: BrokerageAccount[]
    positions: BrokeragePosition[]
    totalValue: number | null
    currency: string | null
    error?: string
}

export type Brokerage = {
    slug: string
    name: string
    url?: string | null
    logo?: string | null
    /** false means view-only, whatever the user picks on the way in. */
    allowsTrading?: boolean | null
    enabled?: boolean | null
    maintenanceMode?: boolean | null
}

export type Connection = {
    id: string
    brokerage: string
    /** SnapTrade lost its access token; the user must reconnect. */
    disabled: boolean
    type?: string | null
    allowsTrading?: boolean | null
    allowsFractionalUnits?: boolean | null
}

export type Order = {
    brokerageOrderId: string | null
    status: string | null
    symbol: string | null
    action: string | null
    totalQuantity: number | null
    filledQuantity: number | null
    executionPrice: number | null
    limitPrice: number | null
    orderType: string | null
    timeInForce: string | null
    timePlaced: string | null
    accountId: string | null
}

export type OrderImpact = {
    tradeId: string
    symbol: string | null
    action: string | null
    units: number | null
    price: number | null
    /** Dollar amount for notional orders; null for share orders. */
    notionalValue: number | null
    estimatedCommission: number | null
    forexFees: number | null
    remainingCash: number | null
    currency: string | null
    exchange: string | null
    symbolCurrency: string | null
}

export type BrokerageAccess = "read" | "trade"

export const accounts = () => apiGet<AccountsResponse>("/api/snaptrade/accounts")

export const connections = () =>
    apiGet<{ configured: boolean; connections: Connection[] }>("/api/snaptrade/connections")

export const brokerages = () =>
    apiGet<{ configured: boolean; brokerages: Brokerage[]; error?: string }>("/api/snaptrade/brokerages")

/** A portal URL. `broker` opens it straight on that brokerage's login. */
export const connect = (access: BrokerageAccess, broker?: string) =>
    apiPost<{ redirectURI: string }>("/api/snaptrade/connect", { access, ...(broker ? { broker } : {}) })

/**
 * Re-authorises one existing connection. `access` must carry the connection's
 * current permission level: the backend defaults an absent value to read-only,
 * which would silently strip trading from a reconnected trade connection.
 */
export const reconnect = (connectionId: string, access: BrokerageAccess) =>
    apiPost<{ redirectURI: string }>("/api/snaptrade/connect", { reconnect: connectionId, access })

export const disconnect = () => apiPost("/api/snaptrade/disconnect")

/**
 * Asks SnapTrade to sync holdings now — the free tier caches them daily, so a
 * fresh trade won't appear otherwise. `refreshed === 0` means every manual sync
 * was declined (billed add-on / rate limit), so nothing new is coming.
 */
export const refresh = () =>
    apiPost<{ refreshed?: number; total?: number }>("/api/snaptrade/refresh")

export const orders = (accountId: string) =>
    apiGet<{ orders: Order[] }>("/api/snaptrade/orders", { accountId })

export const cancelOrder = (accountId: string, brokerageOrderId: string) =>
    apiPost<Order>("/api/snaptrade/orders/cancel", { accountId, brokerageOrderId })

export const quote = (accountId: string, symbol: string) =>
    apiPost<{ symbol?: string; bid?: number; ask?: number; last?: number }>("/api/snaptrade/quote", {
        accountId,
        symbol,
    })

/** Validates a SHARE-quantity order with the brokerage. Nothing is executed. */
export const orderImpact = (body: {
    accountId: string
    symbol: string
    action: string
    orderType: string
    timeInForce: string
    units: number
    price?: number | null
}) => apiPost<OrderImpact>("/api/snaptrade/trade/impact", body)

/** The dollar-amount (notional) form. The backend forces Market + Day. */
export const orderImpactNotional = (body: {
    accountId: string
    symbol: string
    action: string
    notionalValue: number
}) => apiPost<OrderImpact>("/api/snaptrade/trade/impact", body)

/**
 * Executes a reviewed order. The terms are locked to the tradeId server-side,
 * so this can't place anything other than what was just confirmed.
 */
export const placeOrder = (tradeId: string) =>
    apiPost<Order>("/api/snaptrade/trade/place", { tradeId })

/**
 * Whether orders can actually be placed through a connection, and if not,
 * whether reconnecting would help.
 */
export function tradingBlockedReason(connection: Connection | undefined): string | null {
    if (!connection) return null
    if (connection.allowsTrading === false) {
        return `${connection.brokerage} doesn't support placing orders through FinnaCalc. Your holdings show here and orders go in ${connection.brokerage} itself.`
    }
    const type = connection.type?.toLowerCase()
    if (!type) return null // An older backend sends neither field; never block on a guess.
    if (type === "trade") return null
    return `${connection.brokerage} is linked for viewing, so orders are placed in ${connection.brokerage} itself. Enable trading asks ${connection.brokerage} for order access; if it declines, this stays view-only.`
}
