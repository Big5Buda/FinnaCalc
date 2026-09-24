import { describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { BrokerageLinkNotices } from "@/components/investing/brokerage-links"
import {
    CONNECTIONS_UNAVAILABLE,
    connectionNotice,
    disconnectConfirmation,
    loadPortfolio,
    type PortfolioApi,
} from "../investing/portfolio-state"
import type { AccountsResponse, Connection } from "../investing/snaptrade"

const describeError = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback)
const noAccounts: AccountsResponse = { configured: true, accounts: [], positions: [], totalValue: null, currency: null }
const api = (overrides: Partial<PortfolioApi>): PortfolioApi => ({
    accounts: async () => noAccounts,
    connections: async () => ({ configured: true, connections: [] }),
    orders: async () => ({ orders: [] }),
    ...overrides,
})
const render = (connections: Connection[], connectionsError: string | null = null) =>
    renderToStaticMarkup(
        createElement(BrokerageLinkNotices, {
            connections,
            connectionsError,
            busy: null,
            onDisconnect: () => {},
            onReconnect: () => {},
        })
    )

describe("portfolio link management without holdings", () => {
    it("warns about a legacy trade link on a zero-account portfolio and offers disconnect", async () => {
        const legacy = { id: "legacy", brokerage: "Robinhood", disabled: false, type: "trade" }
        const orders = vi.fn()
        const result = await loadPortfolio(
            api({ connections: async () => ({ configured: true, connections: [legacy] }), orders }),
            describeError
        )
        expect(result.data?.accounts).toEqual([])
        expect(result.connections).toEqual([legacy])
        expect(orders).not.toHaveBeenCalled()

        expect(connectionNotice(legacy)?.kind).toBe("relink")
        const html = render(result.connections)
        expect(html).toContain("Robinhood was linked with trading permission.")
        expect(html).toContain("Disconnect all to relink")
        expect(html).not.toContain(">Reconnect<")
        expect(html).not.toMatch(/revoked/i)
    })

    it("treats an unknown-permission link as legacy too", () => {
        const unknown = { id: "unknown", brokerage: "Schwab", disabled: true, type: null }
        expect(connectionNotice(unknown)?.kind).toBe("relink")
        expect(render([unknown])).toContain("doesn&#x27;t report Schwab&#x27;s link as view-only")
    })

    it("keeps a disabled read link repairable by ID when holdings fail", async () => {
        const broken = { id: "conn-7", brokerage: "Fidelity", disabled: true, type: "read" }
        const onReconnect = vi.fn()
        const result = await loadPortfolio(
            api({
                accounts: async () => {
                    throw new Error("Couldn't load holdings from your brokerage.")
                },
                connections: async () => ({ configured: true, connections: [broken] }),
            }),
            describeError
        )
        expect(result.data).toBeNull()
        expect(result.accountsError).toBe("Couldn't load holdings from your brokerage.")
        expect(result.connections).toEqual([broken])
        expect(result.connectionsError).toBeNull()

        const notice = connectionNotice(broken)
        expect(notice).toMatchObject({ kind: "reconnect", connectionId: "conn-7" })
        const html = render(result.connections)
        expect(html).toContain("Fidelity needs reconnecting")
        expect(html).toContain(">Reconnect<")

        const element = BrokerageLinkNotices({
            connections: [broken], connectionsError: null, busy: null, onDisconnect: () => {}, onReconnect,
        })
        const button = findButton(element, "Reconnect")
        button.props.onClick()
        expect(onReconnect).toHaveBeenCalledWith("conn-7")
    })

    it("says so when the link lookup fails instead of implying there is nothing to fix", async () => {
        const result = await loadPortfolio(
            api({
                connections: async () => {
                    throw new Error("down")
                },
            }),
            describeError
        )
        expect(result.connections).toEqual([])
        expect(result.connectionsError).toBe(CONNECTIONS_UNAVAILABLE)
        expect(render([], result.connectionsError)).toContain("Couldn&#x27;t check your brokerage links")
    })

    it("shows nothing for a healthy view-only link", () => {
        expect(connectionNotice({ id: "ok", brokerage: "Alpaca", disabled: false, type: "read" })).toBeNull()
    })

    it("confirms that disconnecting removes every link", () => {
        expect(disconnectConfirmation(1)).toContain("ALL brokerage links")
        expect(disconnectConfirmation(3)).toContain("all 3 of your brokerage links")
    })
})

/** Walks a rendered element tree for the button whose text is `label`. */
function findButton(node: any, label: string): any {
    if (!node || typeof node !== "object") return null
    if (Array.isArray(node)) {
        for (const child of node) {
            const found = findButton(child, label)
            if (found) return found
        }
        return null
    }
    const children = node.props?.children
    if (node.props?.onClick && (children === label || (Array.isArray(children) && children.includes(label)))) return node
    return findButton(children, label)
}
