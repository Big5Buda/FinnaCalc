/**
 * What the portfolio page loads, and what it says about each brokerage link.
 *
 * Link management is loaded independently of holdings. A link that needs
 * reconnecting or relinking has to stay visible — with its action — when the
 * accounts read fails, is denied by the connection limit, or reports no
 * accounts at all, because those are exactly the states such a link causes.
 */

import type { AccountsResponse, Connection, Order } from "./snaptrade"

export type PortfolioApi = {
    accounts: () => Promise<AccountsResponse>
    connections: () => Promise<{ configured: boolean; connections: Connection[] }>
    orders: (accountId: string) => Promise<{ orders: Order[] }>
}

export type PortfolioLoad = {
    data: AccountsResponse | null
    /** The accounts read failed; the reason, as the route stated it. */
    accountsError: string | null
    connections: Connection[]
    /** The link lookup failed, so a link needing attention may be missing. */
    connectionsError: string | null
    orders: Order[]
}

export const CONNECTIONS_UNAVAILABLE =
    "Couldn't check your brokerage links, so a link that needs reconnecting or relinking may not be shown here."

export async function loadPortfolio(
    api: PortfolioApi,
    describe: (error: unknown, fallback: string) => string
): Promise<PortfolioLoad> {
    const [accountsResult, connectionsResult] = await Promise.allSettled([api.accounts(), api.connections()])

    const data = accountsResult.status === "fulfilled" ? accountsResult.value : null
    const accountsError =
        accountsResult.status === "rejected" ? describe(accountsResult.reason, "Couldn't load your portfolio.") : null

    const connections = connectionsResult.status === "fulfilled" ? connectionsResult.value.connections : []
    const connectionsError = connectionsResult.status === "rejected" ? CONNECTIONS_UNAVAILABLE : null

    // Order history per account; one account's failure hides only its own rows.
    const orderResponses = await Promise.all(
        (data?.accounts ?? []).map((account) => api.orders(account.id).catch(() => ({ orders: [] as Order[] })))
    )

    return {
        data,
        accountsError,
        connections,
        connectionsError,
        orders: orderResponses.flatMap((entry) => entry.orders),
    }
}

/**
 * A link SnapTrade doesn't report as exactly "read" — a legacy trading link or
 * one whose permission is unknown. It can't be reconnected in place; the user
 * has to disconnect and link again to get a view-only link.
 */
export function isLegacyPermission(connection: Connection): boolean {
    return connection.type?.trim().toLowerCase() !== "read"
}

export type ConnectionNotice =
    | { kind: "relink"; connectionId: string; message: string }
    | { kind: "reconnect"; connectionId: string; message: string }

/** The notice a link needs, or null for a healthy view-only link. */
export function connectionNotice(connection: Connection): ConnectionNotice | null {
    const name = connection.brokerage
    if (isLegacyPermission(connection)) {
        const cause =
            connection.type?.trim().toLowerCase() === "trade"
                ? `${name} was linked with trading permission.`
                : `SnapTrade doesn't report ${name}'s link as view-only.`
        return {
            kind: "relink",
            connectionId: connection.id,
            message: `${cause} FinnaCalc is view-only and doesn't place or cancel orders, but it can't reconnect or convert this link. For a view-only link, disconnect (this removes every brokerage link on this account from FinnaCalc), then connect ${name} again.`,
        }
    }
    if (connection.disabled) {
        return {
            kind: "reconnect",
            connectionId: connection.id,
            message: `${name} needs reconnecting — the brokerage ended FinnaCalc's access, so holdings have stopped updating.`,
        }
    }
    return null
}

/** The disconnect route deletes the whole SnapTrade user: every link goes. */
export function disconnectConfirmation(linkCount: number): string {
    const scope =
        linkCount > 1
            ? `all ${linkCount} of your brokerage links`
            : "all of your brokerage links"
    return `Disconnect ALL brokerage links?\n\nThis removes ${scope} from FinnaCalc, not just one, and FinnaCalc stops reading their accounts, holdings and order history. Nothing at your brokerage changes: your positions, orders and money stay exactly as they are. You can connect again afterwards, view-only.`
}
