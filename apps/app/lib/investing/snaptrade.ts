/**
 * Typed reads and writes of the SnapTrade routes — the browser twin of
 * Core/SnapTrade/SnapTradeService.swift.
 *
 * View-only: these read balances, holdings and order history, and manage the
 * link itself. Nothing here places, previews or cancels an order. Every route
 * requires a signed-in FinnaCalc user; apiGet/apiPost send the Supabase bearer
 * token with every call.
 */

import { apiGet, apiPost } from "@/lib/api-client"

export type BrokerageAccount = {
    id: string
    name: string
    institution: string
    number: string
    totalValue: number | null
    /** Available cash as the brokerage reports it. */
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
    enabled?: boolean | null
    maintenanceMode?: boolean | null
}

export type Connection = {
    id: string
    brokerage: string
    /** SnapTrade lost its access token; the user must reconnect. */
    disabled: boolean
    /** SnapTrade's permission level for the link: "read" is view-only. */
    type?: string | null
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

export const accounts = () => apiGet<AccountsResponse>("/api/snaptrade/accounts")

export const connections = () =>
    apiGet<{ configured: boolean; connections: Connection[] }>("/api/snaptrade/connections")

export const brokerages = () =>
    apiGet<{ configured: boolean; brokerages: Brokerage[]; error?: string }>("/api/snaptrade/brokerages")

/**
 * A portal URL for a view-only link. `broker` opens it straight on that
 * brokerage's login. The backend asks SnapTrade for read access only.
 */
export const connect = (broker?: string) =>
    apiPost<{ redirectURI: string }>("/api/snaptrade/connect", broker ? { broker } : {})

/**
 * Re-authorises one existing view-only connection by its ID. The backend
 * refuses (409) a link SnapTrade doesn't report as read-only.
 */
export const reconnect = (connectionId: string) =>
    apiPost<{ redirectURI: string }>("/api/snaptrade/connect", { reconnect: connectionId })

export const disconnect = () => apiPost("/api/snaptrade/disconnect")

/**
 * Asks SnapTrade to sync holdings now — the free tier caches them daily, so a
 * trade made at the brokerage won't appear otherwise. `refreshed === 0` means
 * every manual sync was declined (billed add-on / rate limit), so nothing new
 * is coming.
 */
export const refresh = () =>
    apiPost<{ refreshed?: number; total?: number }>("/api/snaptrade/refresh")

export const orders = (accountId: string) =>
    apiGet<{ orders: Order[] }>("/api/snaptrade/orders", { accountId })

/**
 * A link SnapTrade doesn't report as exactly "read" — a legacy trading link or
 * one whose permission is unknown. It can't be reconnected in place; the user
 * has to disconnect and link again to get a view-only link.
 */
export function isLegacyPermission(connection: Connection): boolean {
    return connection.type?.trim().toLowerCase() !== "read"
}
