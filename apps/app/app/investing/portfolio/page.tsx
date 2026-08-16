"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Landmark, Loader2, RefreshCw, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { compactMoney, currency, fixed } from "@/lib/format"
import { ApiError } from "@/lib/api-client"
import { marketStats } from "@/lib/investing/market"
import {
    accounts as fetchAccounts,
    brokerages as fetchBrokerages,
    cancelOrder,
    connect,
    connections as fetchConnections,
    disconnect,
    orders as fetchOrders,
    refresh as requestSync,
    tradingBlockedReason,
    type AccountsResponse,
    type Brokerage,
    type BrokerageAccess,
    type Connection,
    type Order,
} from "@/lib/investing/snaptrade"
import { holdings, provisionalPositions } from "@/lib/investing/analytics"
import { useAuth } from "@/components/providers/auth-provider"
import { CompanyLogo } from "@/components/investing/pieces"
import { Button, Notice, SectionLabel } from "@/components/ui/primitives"

/**
 * Portfolio — connect a brokerage through SnapTrade, then the total value, the
 * holdings ledger and recent orders. Ported from BrokerageConnectView.swift and
 * PortfolioLedgerView.swift.
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
    const [orderRows, setOrderRows] = useState<Order[]>([])
    const [prices, setPrices] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const response = await fetchAccounts()
            setData(response)

            if (response.accounts.length > 0) {
                const [connectionsResponse, ...orderResponses] = await Promise.all([
                    fetchConnections().catch(() => ({ configured: false, connections: [] })),
                    ...response.accounts.map((account) =>
                        fetchOrders(account.id).catch(() => ({ orders: [] as Order[] }))
                    ),
                ])
                setConnections(connectionsResponse.connections)
                setOrderRows(orderResponses.flatMap((entry) => entry.orders))
            }
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Couldn't load your portfolio.")
        }
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

    async function startConnect(access: BrokerageAccess, broker?: string) {
        setBusy("connect")
        setError(null)
        try {
            const { redirectURI } = await connect(access, broker)
            window.location.href = redirectURI
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Couldn't start the connection.")
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
        const ok = window.confirm(
            "Disconnect your brokerage?\n\nFinnaCalc stops reading your accounts and holdings. Nothing at your brokerage changes: your positions, orders and money stay exactly as they are."
        )
        if (!ok) return
        setBusy("disconnect")
        try {
            await disconnect()
            setData(null)
            setConnections([])
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
                    to connect a brokerage. Trading routes verify your account, so a browser session alone
                    can&rsquo;t place orders.
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

    return (
        <Shell>
            {error && <Notice tone="error">{error}</Notice>}
            {notice && <Notice tone="info">{notice}</Notice>}

            {!connected ? (
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
                            Disconnect
                        </Button>
                    </div>

                    {connections.map((connection) => {
                        const blocked = tradingBlockedReason(connection)
                        if (!connection.disabled && !blocked) return null
                        return (
                            <Notice key={connection.id} tone="caution">
                                {connection.disabled
                                    ? `${connection.brokerage} needs reconnecting — the brokerage ended FinnaCalc's access, so holdings have stopped updating.`
                                    : blocked}
                                <div className="mt-2">
                                    <Button
                                        size="sm"
                                        onClick={() =>
                                            void startConnect(
                                                connection.type?.toLowerCase() === "trade" ? "trade" : "read"
                                            )
                                        }
                                    >
                                        {connection.disabled ? "Reconnect" : "Enable trading"}
                                    </Button>
                                </div>
                            </Notice>
                        )
                    })}

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
                                        <Link
                                            href={`/investing/trade/${row.symbol}`}
                                            className="shrink-0 text-xs font-semibold text-primary"
                                        >
                                            Trade
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <OrdersSection
                        orders={orderRows}
                        onCancel={async (order) => {
                            if (!order.accountId || !order.brokerageOrderId) return
                            const ok = window.confirm(
                                `Cancel this ${order.action ?? "order"} of ${order.totalQuantity ?? "?"} ${order.symbol ?? ""}?\n\nThe request goes to your brokerage, which decides whether it can still be cancelled.`
                            )
                            if (!ok) return
                            try {
                                await cancelOrder(order.accountId, order.brokerageOrderId)
                                await load()
                            } catch (err) {
                                setError(err instanceof ApiError ? err.message : "Couldn't cancel that order.")
                            }
                        }}
                    />
                </>
            )}
        </Shell>
    )
}

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-6">
            <header className="flex flex-col gap-1">
                <Link href="/investing" className="text-sm font-semibold text-primary">
                    ← Investing
                </Link>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Portfolio</h1>
                <p className="text-sm text-muted-foreground">
                    Your own accounts, read straight from your brokerage.
                </p>
            </header>
            {children}
        </div>
    )
}

function ConnectPanel({
    onConnect,
    busy,
}: {
    onConnect: (access: BrokerageAccess, broker?: string) => void
    busy: boolean
}) {
    const [list, setList] = useState<Brokerage[]>([])
    const [access, setAccess] = useState<BrokerageAccess>("read")
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

            <div className="flex rounded-full bg-secondary p-[3px]">
                {(
                    [
                        { value: "read", label: "View only" },
                        { value: "trade", label: "View and trade" },
                    ] as { value: BrokerageAccess; label: string }[]
                ).map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => setAccess(option.value)}
                        className={cn(
                            "flex-1 rounded-full py-2 text-xs transition",
                            access === option.value
                                ? "bg-card font-bold text-foreground shadow-sm"
                                : "font-semibold text-muted-foreground"
                        )}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            <p className="text-xs text-muted-foreground">
                {access === "trade"
                    ? "Orders you place here are reviewed by you and executed by your brokerage under its own terms. FinnaCalc never holds your money or securities."
                    : "Holdings and orders are read-only. You can upgrade a connection later."}
            </p>

            <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find your brokerage"
                aria-label="Find your brokerage"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
            />

            <div className="grid grid-cols-2 gap-2">
                {filtered.map((brokerage) => (
                    <button
                        key={brokerage.slug}
                        type="button"
                        onClick={() => onConnect(access, brokerage.slug)}
                        disabled={busy}
                        className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-left text-sm font-semibold text-foreground transition hover:border-border-strong disabled:opacity-50"
                    >
                        <span className="truncate">{brokerage.name}</span>
                        {brokerage.allowsTrading === false && (
                            <span className="ml-auto shrink-0 text-[10px] font-bold text-muted-foreground">
                                VIEW
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <Button onClick={() => onConnect(access)} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Browse all brokerages
            </Button>
        </section>
    )
}

function OrdersSection({ orders, onCancel }: { orders: Order[]; onCancel: (order: Order) => void }) {
    if (orders.length === 0) return null
    const open = (status: string | null) =>
        Boolean(status && !/FILLED|CANCEL|REJECT|EXPIRED/i.test(status))

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
                        {open(order.status) && order.accountId && order.brokerageOrderId && (
                            <button
                                type="button"
                                onClick={() => onCancel(order)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-destructive"
                            >
                                <X className="h-3 w-3" />
                                Cancel
                            </button>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    )
}
