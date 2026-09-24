"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Landmark, Loader2, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { compactMoney, currency, fixed } from "@/lib/format"
import { ApiError } from "@/lib/api-client"
import { marketStats } from "@/lib/investing/market"
import {
    accounts as fetchAccounts,
    brokerages as fetchBrokerages,
    connect,
    connections as fetchConnections,
    disconnect,
    orders as fetchOrders,
    reconnect,
    refresh as requestSync,
    type AccountsResponse,
    type Brokerage,
    type Connection,
    type Order,
} from "@/lib/investing/snaptrade"
import { holdings, provisionalPositions } from "@/lib/investing/analytics"
import { disconnectConfirmation, loadPortfolio } from "@/lib/investing/portfolio-state"
import { BrokerageLinkNotices } from "@/components/investing/brokerage-links"
import { useAuth } from "@/components/providers/auth-provider"
import { CompanyLogo } from "@/components/investing/pieces"
import { Button, Notice, SectionLabel } from "@/components/ui/primitives"
import { PageBar, PageBody } from "@/components/shell/surface"

/**
 * Portfolio — connect a brokerage through SnapTrade, then the total value, the
 * holdings ledger and recent orders. Ported from BrokerageConnectView.swift and
 * PortfolioLedgerView.swift.
 *
 * View-only. Every link asks SnapTrade for read access; nothing on this page
 * places, previews or cancels an order. A legacy link that isn't reported as
 * read-only is flagged, with disconnect-and-relink as the way out.
 *
 * Nothing here is ever placeheld: a value the brokerage hasn't reported and a
 * quote we can't fetch both render as a dash. Holdings the daily sync hasn't
 * delivered yet are derived from executed orders, priced by live quote, and
 * labelled as such.
 */
export default function PortfolioPage() {
    const { user, loading: authLoading } = useAuth()
    const [data, setData] = useState<AccountsResponse | null>(null)
    const [connections, setConnections] = useState<Connection[]>([])
    const [connectionsError, setConnectionsError] = useState<string | null>(null)
    const [orderRows, setOrderRows] = useState<Order[]>([])
    const [prices, setPrices] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        // Links load independently of holdings, so a link that is the reason
        // holdings failed still shows with its recovery action.
        const result = await loadPortfolio(
            { accounts: fetchAccounts, connections: fetchConnections, orders: fetchOrders },
            (err, fallback) => (err instanceof ApiError ? err.message : fallback)
        )
        setData(result.data)
        setError(result.accountsError)
        setConnections(result.connections)
        setConnectionsError(result.connectionsError)
        setOrderRows(result.orders)
        setLoading(false)
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    // Value whatever the brokerage didn't price, so a position never counts as
    // zero and quietly shrinks every other weight.
    useEffect(() => {
        const positions = [
            ...(data?.positions ?? []),
            ...provisionalPositions(orderRows, (data?.positions ?? []).map((p) => p.symbol)),
        ]
        const unpriced = positions.filter((p) => p.marketValue === null && p.price === null)
        if (unpriced.length === 0) return
        let active = true
        const symbols = [...new Set(unpriced.map((p) => p.symbol.toUpperCase()))].slice(0, 6)
        marketStats(symbols)
            .then((response) => {
                if (!active) return
                const next: Record<string, number> = {}
                for (const stat of response.stats) next[stat.symbol.toUpperCase()] = stat.price
                setPrices(next)
            })
            .catch(() => {})
        return () => {
            active = false
        }
    }, [data, orderRows])

    async function startConnect(broker?: string) {
        setBusy("connect")
        setError(null)
        try {
            const { redirectURI } = await connect(broker)
            window.location.href = redirectURI
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Couldn't start the connection.")
            setBusy(null)
        }
    }

    async function startReconnect(connectionId: string) {
        setBusy(`reconnect:${connectionId}`)
        setError(null)
        try {
            const { redirectURI } = await reconnect(connectionId)
            window.location.href = redirectURI
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Couldn't start the reconnection.")
            setBusy(null)
        }
    }

    async function sync() {
        setBusy("sync")
        setNotice(null)
        try {
            const { refreshed = 0, total = 0 } = await requestSync()
            if (refreshed > 0) {
                // The sync is asynchronous on SnapTrade's side.
                setNotice("Sync requested. Holdings update in a moment.")
                setTimeout(() => void load(), 5000)
            } else {
                setNotice(
                    total > 0
                        ? "Your brokerage declined an immediate sync, so holdings stay on their daily update."
                        : "No connection to sync."
                )
            }
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Couldn't request a sync.")
        }
        setBusy(null)
    }

    async function unlink() {
        const ok = window.confirm(disconnectConfirmation(connections.length))
        if (!ok) return
        setBusy("disconnect")
        try {
            await disconnect()
            setData(null)
            setConnections([])
            setConnectionsError(null)
            setOrderRows([])
            await load()
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Couldn't disconnect.")
        }
        setBusy(null)
    }

    const positions = [
        ...(data?.positions ?? []),
        ...provisionalPositions(orderRows, (data?.positions ?? []).map((p) => p.symbol)),
    ]
    const rows = holdings(positions, prices)
    const holdingsTotal = rows.reduce((sum, row) => sum + row.value, 0)
    /** What the investments are worth; the reported balance includes idle cash. */
    const totalValue = holdingsTotal > 0 ? holdingsTotal : data?.totalValue ?? null

    if (!authLoading && !user) {
        return (
            <Shell>
                <Notice tone="info">
                    <Link href="/sign-in?next=/investing/portfolio" className="font-semibold text-primary">
                        Sign in
                    </Link>{" "}
                    to connect a brokerage. Links are view-only: FinnaCalc reads your balances, holdings and
                    order history, and never places or cancels orders.
                </Notice>
            </Shell>
        )
    }

    if (loading) {
        return (
            <Shell>
                <div className="h-40 animate-pulse rounded-card bg-card" />
            </Shell>
        )
    }

    if (data && !data.configured) {
        return (
            <Shell>
                <Notice tone="info">
                    Brokerage connections aren&rsquo;t configured on this deployment (SnapTrade keys are
                    missing), so there&rsquo;s nothing to connect to yet.
                </Notice>
            </Shell>
        )
    }

    const connected = (data?.accounts.length ?? 0) > 0
    const linked = connections.length > 0

    return (
        <Shell>
            {error && <Notice tone="error">{error}</Notice>}
            {notice && <Notice tone="info">{notice}</Notice>}

            <BrokerageLinkNotices
                connections={connections}
                connectionsError={connectionsError}
                busy={busy}
                onDisconnect={() => void unlink()}
                onReconnect={(connectionId) => void startReconnect(connectionId)}
            />

            {!connected && linked ? (
                // Linked, but no holdings to show: the accounts read failed or
                // reported nothing. Keep the link manageable rather than
                // offering a fresh connection the limit may refuse.
                <>
                    {!error && (
                        <Notice tone="info">
                            Your brokerage link hasn&rsquo;t reported any accounts yet. A new link can take a
                            moment; try again shortly.
                        </Notice>
                    )}
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => void load()}>
                            <RefreshCw className="h-4 w-4" />
                            Try again
                        </Button>
                        <Button variant="ghost" onClick={() => void unlink()} disabled={busy === "disconnect"}>
                            Disconnect all
                        </Button>
                    </div>
                </>
            ) : !connected ? (
                <ConnectPanel onConnect={startConnect} busy={busy === "connect"} />
            ) : (
                <>
                    <section className="flex flex-col gap-1 rounded-card border-[1.5px] border-border bg-foreground p-5 text-background">
                        <p className="text-[11px] font-bold uppercase tracking-[0.09em] opacity-70">
                            Total value
                        </p>
                        <p className="figure text-4xl font-bold">
                            {totalValue !== null ? currency(totalValue, 2) : "—"}
                        </p>
                        <p className="text-xs opacity-70">
                            {rows.length} holding{rows.length === 1 ? "" : "s"} across{" "}
                            {data?.accounts.length} account{data?.accounts.length === 1 ? "" : "s"}
                        </p>
                    </section>

                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => void sync()} disabled={busy === "sync"}>
                            {busy === "sync" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4" />
                            )}
                            Sync holdings
                        </Button>
                        <Link
                            href="/investing/portfolio/analysis"
                            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-semibold text-foreground transition hover:bg-secondary"
                        >
                            Portfolio analysis
                        </Link>
                        <Button variant="ghost" onClick={() => void unlink()} disabled={busy === "disconnect"}>
                            Disconnect all
                        </Button>
                    </div>

                    <section className="flex flex-col gap-2.5">
                        <SectionLabel>Holdings</SectionLabel>
                        {rows.length === 0 ? (
                            <Notice tone="info">
                                No holdings reported yet. A brokerage that has just been connected can take a
                                day to deliver them, and a sync request above asks for them sooner.
                            </Notice>
                        ) : (
                            <ul className="overflow-hidden rounded-card border-[1.5px] border-border bg-card">
                                {rows.map((row, index) => (
                                    <li
                                        key={row.symbol}
                                        className={cn("flex items-center gap-3 px-4 py-3", index > 0 && "border-t border-border")}
                                    >
                                        <CompanyLogo symbol={row.symbol} size={36} />
                                        <Link
                                            href={`/investing/stocks/${row.symbol}`}
                                            className="flex min-w-0 flex-1 flex-col"
                                        >
                                            <span className="truncate text-sm font-semibold text-foreground">
                                                {row.description || row.symbol}
                                            </span>
                                            <span className="figure text-[11px] font-normal text-muted-foreground">
                                                {fixed(row.units, row.units % 1 === 0 ? 0 : 4)} shares ·{" "}
                                                {fixed(row.weight * 100, 1)}% of portfolio
                                            </span>
                                        </Link>
                                        <span className="flex shrink-0 flex-col items-end">
                                            <span className="figure text-sm font-semibold text-foreground">
                                                {compactMoney(row.value)}
                                            </span>
                                            {row.openPnl !== null && (
                                                <span
                                                    className={cn(
                                                        "figure text-xs",
                                                        row.openPnl >= 0 ? "text-positive" : "text-negative"
                                                    )}
                                                >
                                                    {row.openPnl >= 0 ? "+" : "−"}
                                                    {compactMoney(Math.abs(row.openPnl))}
                                                </span>
                                            )}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <OrdersSection orders={orderRows} />
                </>
            )}
        </Shell>
    )
}

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <>
            <PageBar
                back={{ href: "/investing", label: "Investing" }}
                title="Portfolio"
            />
            <PageBody className="flex w-full max-w-6xl flex-col gap-5">
            <header className="flex flex-col gap-1">
                <p className="text-sm text-muted-foreground">
                    Your own accounts, read straight from your brokerage.
                </p>
            </header>
            {children}
            </PageBody>
        </>
    )
}

function ConnectPanel({
    onConnect,
    busy,
}: {
    onConnect: (broker?: string) => void
    busy: boolean
}) {
    const [list, setList] = useState<Brokerage[]>([])
    const [query, setQuery] = useState("")

    useEffect(() => {
        let active = true
        fetchBrokerages()
            .then((response) => active && setList(response.brokerages))
            .catch(() => {})
        return () => {
            active = false
        }
    }, [])

    const filtered = list
        .filter((brokerage) => brokerage.enabled !== false)
        .filter((brokerage) => brokerage.name.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 24)

    return (
        <section className="flex flex-col gap-4 rounded-card border-[1.5px] border-border bg-card p-5">
            <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/12 text-primary">
                    <Landmark className="h-5 w-5" />
                </span>
                <div className="flex flex-col">
                    <p className="text-base font-bold text-foreground">Connect your brokerage</p>
                    <p className="text-xs text-muted-foreground">
                        Through SnapTrade. Your brokerage credentials go to them directly and never touch
                        FinnaCalc.
                    </p>
                </div>
            </div>

            <p className="text-xs text-muted-foreground">
                View only. FinnaCalc reads your balances, holdings and order history; it can&rsquo;t place
                or cancel orders. Trades happen in your brokerage&rsquo;s own app or site.
            </p>

            <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find your brokerage"
                aria-label="Find your brokerage"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground  focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            />

            <div className="grid grid-cols-2 gap-2">
                {filtered.map((brokerage) => (
                    <button
                        key={brokerage.slug}
                        type="button"
                        onClick={() => onConnect(brokerage.slug)}
                        disabled={busy}
                        className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-left text-sm font-semibold text-foreground transition hover:border-border-strong disabled:opacity-50"
                    >
                        <span className="truncate">{brokerage.name}</span>
                    </button>
                ))}
            </div>

            <Button onClick={() => onConnect()} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Browse all brokerages
            </Button>
        </section>
    )
}

/** Order history as the brokerage reports it. Read-only: orders are placed
 *  and cancelled at the brokerage, never here. */
function OrdersSection({ orders }: { orders: Order[] }) {
    if (orders.length === 0) return null

    return (
        <section className="flex flex-col gap-2.5">
            <SectionLabel>Recent orders</SectionLabel>
            <ul className="overflow-hidden rounded-card border-[1.5px] border-border bg-card">
                {orders.slice(0, 20).map((order, index) => (
                    <li
                        key={`${order.brokerageOrderId}-${index}`}
                        className={cn("flex items-center gap-3 px-4 py-3", index > 0 && "border-t border-border")}
                    >
                        <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-semibold text-foreground">
                                {order.action} {order.symbol}
                            </span>
                            <span className="figure text-[11px] font-normal text-muted-foreground">
                                {order.filledQuantity ?? order.totalQuantity ?? "—"} shares ·{" "}
                                {order.status ?? "—"}
                                {order.executionPrice ? ` · ${currency(order.executionPrice, 2)}` : ""}
                            </span>
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    )
}
